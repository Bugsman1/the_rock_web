import { z } from "zod";
import type { ApiSchema } from "./api/client";
import { addHours, isIsoDate, isTimeValue } from "./datetime";
import { fromDecimal } from "./format";
import type { IsoTimestamp } from "./format";
import { isInService, parseGrinderCode } from "./projects";
import type { Grinder, ProjectId } from "./projects";

export const machineStatuses = ["running", "idle", "maintenance"] as const;

export type MachineStatus = (typeof machineStatuses)[number];

export type Machine = {
  grinderId: string;
  project: ProjectId;
  number: number;
  inMaintenance: boolean;
};

export type MillingOperation = {
  id: string;
  project: ProjectId;
  machine: number;
  shipmentNumber: string;
  client: string;
  bags: number;
  operatorName: string;
  startedAt: IsoTimestamp;
  estimatedEndAt: IsoTimestamp;
  notes: string;
  cost: number;
  endedAt?: IsoTimestamp;
  bagsMilled?: number;
  mercury?: MercuryAdded;
};

type MercuryAdded = {
  addedAt: IsoTimestamp;
  byName: string;
};

export type OperationShipment = {
  id: string;
  shipmentNumber: string;
  client: string;
  bags: number;
  remainingBags: number;
  pending: boolean;
};

export const CAPACITY_BAGS = 2;
export const CAPACITY_HOURS = 6;
export const BAG_STEP = 0.5;

export function isHalfBagCount(bags: number): boolean {
  return bags > 0 && Number.isInteger(bags / BAG_STEP);
}

export function machinesFromGrinders(grinders: readonly Grinder[]): readonly Machine[] {
  return grinders.filter(isInService).map((grinder) => ({
    grinderId: grinder.id,
    project: grinder.project,
    number: grinder.number,
    inMaintenance: grinder.status === "maintenance",
  }));
}

export function machinesOfProject(
  machines: readonly Machine[],
  project: ProjectId,
): readonly Machine[] {
  return machines
    .filter((machine) => machine.project === project)
    .sort((a, b) => a.number - b.number);
}

export function estimatedEnd(startedAt: IsoTimestamp, bags: number): IsoTimestamp {
  return addHours(startedAt, (bags * CAPACITY_HOURS) / CAPACITY_BAGS);
}

export function isRunning(operation: MillingOperation): boolean {
  return operation.endedAt === undefined;
}

export function operationsOfMachine(
  operations: readonly MillingOperation[],
  project: ProjectId,
  machine: number,
): readonly MillingOperation[] {
  return operations.filter(
    (operation) => operation.project === project && operation.machine === machine,
  );
}

export function activeOperationOf(
  operations: readonly MillingOperation[],
  project: ProjectId,
  machine: number,
): MillingOperation | undefined {
  return operationsOfMachine(operations, project, machine).find(isRunning);
}

export function machineStatus(
  machine: Machine,
  operations: readonly MillingOperation[],
): MachineStatus {
  if (activeOperationOf(operations, machine.project, machine.number) !== undefined) {
    return "running";
  }

  return machine.inMaintenance ? "maintenance" : "idle";
}

export function idleMachines(
  machines: readonly Machine[],
  operations: readonly MillingOperation[],
): readonly Machine[] {
  return machines.filter((machine) => machineStatus(machine, operations) === "idle");
}

export function operationsOfShipment(
  shipmentNumber: string,
  operations: readonly MillingOperation[],
): readonly MillingOperation[] {
  return operations.filter((operation) => operation.shipmentNumber === shipmentNumber);
}

function bagsConsumed(operation: MillingOperation): number {
  return isRunning(operation) ? operation.bags : (operation.bagsMilled ?? operation.bags);
}

export function remainingBags(
  shipment: { shipmentNumber: string; bags: number },
  operations: readonly MillingOperation[],
): number {
  const consumed = operationsOfShipment(shipment.shipmentNumber, operations).reduce(
    (total, operation) => total + bagsConsumed(operation),
    0,
  );

  return Math.max(0, shipment.bags - consumed);
}

export function operationFromApi(
  operation: ApiSchema<"GrindingOperation">,
): readonly MillingOperation[] {
  const grinder = parseGrinderCode(operation.grinder_code);

  if (grinder === undefined) {
    return [];
  }

  const endedAt = operation.end_time ?? undefined;
  const mercuryAddedAt = operation.mercury_added_at ?? undefined;

  return [
    {
      id: String(operation.id),
      project: grinder.project,
      machine: grinder.number,
      shipmentNumber: operation.shipment_number,
      client: operation.customer_name,
      bags: operation.bags_count,
      operatorName: operation.operator_name,
      startedAt: operation.start_time,
      estimatedEndAt: estimatedEnd(operation.start_time, operation.bags_count),
      notes: operation.notes ?? "",
      cost: fromDecimal(operation.grinding_cost ?? "0"),
      ...(endedAt === undefined ? {} : { endedAt, bagsMilled: operation.bags_count }),
      ...(mercuryAddedAt === undefined
        ? {}
        : { mercury: { addedAt: mercuryAddedAt, byName: operation.mercury_added_by_name } }),
    },
  ];
}

type NewOperationRules = {
  remainingBagsOf: (shipmentNumber: string) => number | undefined;
  isMachineIdle: (machine: number) => boolean;
};

export function createNewOperationSchema(
  messages: {
    required: string;
    bagsInvalid: string;
    bagsOverCapacity: string;
    bagsTooMany: string;
    machineUnavailable: string;
    dateInvalid: string;
    timeInvalid: string;
  },
  rules: NewOperationRules,
) {
  return z
    .object({
      shipmentNumber: z.string().min(1, messages.required),
      machine: z
        .string()
        .min(1, { message: messages.required, abort: true })
        .refine((value) => rules.isMachineIdle(Number(value)), messages.machineUnavailable),
      bags: z
        .number({ error: messages.required })
        .refine(isHalfBagCount, messages.bagsInvalid)
        .refine((bags) => bags <= CAPACITY_BAGS, messages.bagsOverCapacity),
      startDate: z
        .string()
        .min(1, { message: messages.required, abort: true })
        .refine(isIsoDate, messages.dateInvalid),
      startTime: z
        .string()
        .min(1, { message: messages.required, abort: true })
        .refine(isTimeValue, messages.timeInvalid),
      operatorId: z.string().min(1, messages.required),
      notes: z.string().trim().max(500),
    })
    .superRefine((values, context) => {
      const remaining = rules.remainingBagsOf(values.shipmentNumber);

      if (remaining !== undefined && values.bags > remaining) {
        context.addIssue({ code: "custom", path: ["bags"], message: messages.bagsTooMany });
      }
    });
}

export type NewOperationValues = z.infer<ReturnType<typeof createNewOperationSchema>>;
