import { z } from "zod";
import { combineDateAndTime, isIsoDate, isSameDay, isTimeValue } from "@/lib/datetime";
import type { IsoTimestamp } from "@/lib/format";
import {
  isRunning,
  machinesOfProject,
  machineStatus,
  operationsOfMachine,
  operationsOfShipment,
  remainingBags,
} from "@/lib/grinding";
import type { Machine, MachineStatus, MillingOperation } from "@/lib/grinding";
import type { Project, ProjectId, SiteKey } from "@/lib/projects";
import type { ShipmentRecord, ShipmentStatusKey } from "@/lib/shipments";

export type SiteFilter = SiteKey | "all";

export type MachineStatusFilter = MachineStatus | "all";

export type MillingShipment = {
  id: string;
  shipmentNumber: string;
  client: string;
  project: ProjectId;
  bags: number;
  arrivedAt: IsoTimestamp;
  started: boolean;
};

type ShipmentMillingStatus = "pending" | "partiallyMilled" | "milled";

export type MachineCounts = Record<MachineStatus, number> & { total: number };

export function findMachine(
  machines: readonly Machine[],
  project: ProjectId,
  number: number,
): Machine | undefined {
  return machines.find((machine) => machine.project === project && machine.number === number);
}

function operationsOfProject(
  operations: readonly MillingOperation[],
  project: ProjectId,
): readonly MillingOperation[] {
  return operations.filter((operation) => operation.project === project);
}

export function operationHistory(
  operations: readonly MillingOperation[],
  project: ProjectId,
  machine: number,
): readonly MillingOperation[] {
  return [...operationsOfMachine(operations, project, machine)].sort((a, b) =>
    b.startedAt.localeCompare(a.startedAt),
  );
}

export function bagsMilledOn(operations: readonly MillingOperation[], day: IsoTimestamp): number {
  return operations
    .filter((operation) => operation.endedAt !== undefined && isSameDay(operation.endedAt, day))
    .reduce((total, operation) => total + operation.bags, 0);
}

export function countMachines(
  machines: readonly Machine[],
  operations: readonly MillingOperation[],
): MachineCounts {
  const counts: MachineCounts = { running: 0, idle: 0, maintenance: 0, total: machines.length };

  for (const machine of machines) {
    counts[machineStatus(machine, operations)] += 1;
  }

  return counts;
}

export function shipmentMillingStatus(
  shipment: MillingShipment,
  operations: readonly MillingOperation[],
): ShipmentMillingStatus {
  const related = operationsOfShipment(shipment.shipmentNumber, operations);

  if (related.length === 0) {
    return "pending";
  }

  return remainingBags(shipment, operations) === 0 && !related.some(isRunning)
    ? "milled"
    : "partiallyMilled";
}

export function shipmentStatusFor(
  shipment: MillingShipment,
  operations: readonly MillingOperation[],
): ShipmentStatusKey {
  return shipmentMillingStatus(shipment, operations) === "milled" ? "completed" : "grinding";
}

export function millingQueue(
  shipments: readonly MillingShipment[],
  operations: readonly MillingOperation[],
  project: ProjectId,
): readonly MillingShipment[] {
  return shipments
    .filter((shipment) => shipment.project === project && remainingBags(shipment, operations) > 0)
    .sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt));
}

const millingStatuses: readonly ShipmentStatusKey[] = ["pending", "grinding"];

export function millingShipments(records: readonly ShipmentRecord[]): readonly MillingShipment[] {
  return records.flatMap(
    ({ id, shipmentNumber, customerName, project, bagCount, arrivedAt, status }) =>
      millingStatuses.includes(status)
        ? [
            {
              id,
              shipmentNumber,
              client: customerName,
              project,
              bags: bagCount,
              arrivedAt,
              started: status === "grinding",
            },
          ]
        : [],
  );
}

export type MillingSummary = {
  machines: MachineCounts;
  bagsMilling: number;
  bagsWaiting: number;
  bagsMilledToday: number;
  waitingShipments: number;
};

type MillingRecords = {
  machines: readonly Machine[];
  operations: readonly MillingOperation[];
  shipments: readonly MillingShipment[];
};

export function projectSummary(
  records: MillingRecords,
  project: ProjectId,
  now: IsoTimestamp,
): MillingSummary {
  const operations = operationsOfProject(records.operations, project);
  const queue = millingQueue(records.shipments, records.operations, project);

  return {
    machines: countMachines(machinesOfProject(records.machines, project), records.operations),
    bagsMilling: operations
      .filter(isRunning)
      .reduce((total, operation) => total + operation.bags, 0),
    bagsWaiting: queue.reduce(
      (total, shipment) => total + remainingBags(shipment, records.operations),
      0,
    ),
    bagsMilledToday: bagsMilledOn(operations, now),
    waitingShipments: queue.length,
  };
}

const BACKLOG_BAGS = 50;

export function isBacklogged(bagsWaiting: number): boolean {
  return bagsWaiting >= BACKLOG_BAGS;
}

export function combineSummaries(summaries: readonly MillingSummary[]): MillingSummary {
  return summaries.reduce<MillingSummary>(
    (total, summary) => ({
      machines: {
        running: total.machines.running + summary.machines.running,
        idle: total.machines.idle + summary.machines.idle,
        maintenance: total.machines.maintenance + summary.machines.maintenance,
        total: total.machines.total + summary.machines.total,
      },
      bagsMilling: total.bagsMilling + summary.bagsMilling,
      bagsWaiting: total.bagsWaiting + summary.bagsWaiting,
      bagsMilledToday: total.bagsMilledToday + summary.bagsMilledToday,
      waitingShipments: total.waitingShipments + summary.waitingShipments,
    }),
    {
      machines: { running: 0, idle: 0, maintenance: 0, total: 0 },
      bagsMilling: 0,
      bagsWaiting: 0,
      bagsMilledToday: 0,
      waitingShipments: 0,
    },
  );
}

export function projectsForSite(
  projects: readonly Project[],
  site: SiteFilter,
): readonly Project[] {
  return site === "all" ? projects : projects.filter((project) => project.site === site);
}

export function createEndMillingSchema(
  messages: {
    required: string;
    dateInvalid: string;
    timeInvalid: string;
    endBeforeStart: string;
  },
  limits: { startedAt: IsoTimestamp },
) {
  return z
    .object({
      endDate: z
        .string()
        .min(1, { message: messages.required, abort: true })
        .refine(isIsoDate, messages.dateInvalid),
      endTime: z
        .string()
        .min(1, { message: messages.required, abort: true })
        .refine(isTimeValue, messages.timeInvalid),
      notes: z.string().trim().max(500),
    })
    .superRefine((values, context) => {
      const endedAt = combineDateAndTime(values.endDate, values.endTime);

      if (endedAt !== undefined && endedAt <= limits.startedAt) {
        context.addIssue({ code: "custom", path: ["endTime"], message: messages.endBeforeStart });
      }
    });
}

export type EndMillingValues = z.infer<ReturnType<typeof createEndMillingSchema>>;
