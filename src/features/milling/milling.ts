import { z } from "zod";
import type { ApiSchema } from "@/lib/api/client";
import { combineDateAndTime, isIsoDate, isTimeValue } from "@/lib/datetime";
import { fromDecimal } from "@/lib/format";
import type { IsoTimestamp } from "@/lib/format";
import { machineStatus } from "@/lib/grinding";
import type { Machine, MachineStatus, MillingOperation, OperationShipment } from "@/lib/grinding";
import { rowOfProject } from "@/lib/projects";
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
  remainingBags: number;
  arrivedAt: IsoTimestamp;
  started: boolean;
};

export type ShipmentMillingStatus = "pending" | "partiallyMilled" | "milled";

export type MachineCounts = Record<MachineStatus, number> & { total: number };

export function findMachine(
  machines: readonly Machine[],
  project: ProjectId,
  number: number,
): Machine | undefined {
  return machines.find((machine) => machine.project === project && machine.number === number);
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

export function millingQueue(
  shipments: readonly MillingShipment[],
  project: ProjectId,
): readonly MillingShipment[] {
  return shipments
    .filter((shipment) => shipment.project === project && shipment.remainingBags > 0)
    .sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt));
}

export function withBagsFreedBy(
  shipments: readonly MillingShipment[],
  operation: MillingOperation,
): readonly MillingShipment[] {
  return shipments.map((shipment) =>
    shipment.shipmentNumber === operation.shipmentNumber
      ? { ...shipment, remainingBags: shipment.remainingBags + operation.bags }
      : shipment,
  );
}

export function operationShipments(
  queue: readonly MillingShipment[],
): readonly OperationShipment[] {
  return queue.map((shipment) => ({
    id: shipment.id,
    shipmentNumber: shipment.shipmentNumber,
    client: shipment.client,
    bags: shipment.bags,
    remainingBags: shipment.remainingBags,
    arrivedAt: shipment.arrivedAt,
  }));
}

export const millingStatuses: readonly ShipmentStatusKey[] = ["pending", "grinding"];

export function millingShipments(records: readonly ShipmentRecord[]): readonly MillingShipment[] {
  return records.flatMap(
    ({ id, shipmentNumber, customerName, project, bagCount, remainingBags, arrivedAt, status }) =>
      millingStatuses.includes(status)
        ? [
            {
              id,
              shipmentNumber,
              client: customerName,
              project,
              bags: bagCount,
              remainingBags,
              arrivedAt,
              started: status === "grinding",
            },
          ]
        : [],
  );
}

export type MillingSummary = {
  bagsWaiting: number;
  waitingShipments: number;
  bagsMilling: number;
  bagsMilledToday: number;
  machinesRunning: number;
  machinesInService: number;
};

type ProjectMillingSummary = MillingSummary & { project: ProjectId };

const noMilling: MillingSummary = {
  bagsWaiting: 0,
  waitingShipments: 0,
  bagsMilling: 0,
  bagsMilledToday: 0,
  machinesRunning: 0,
  machinesInService: 0,
};

export function millingSummaryFromApi(
  rows: readonly ApiSchema<"ProjectGrindingSummary">[],
): readonly ProjectMillingSummary[] {
  return rows.map((row) => ({
    project: String(row.project),
    bagsWaiting: fromDecimal(row.bags_waiting),
    waitingShipments: row.waiting_shipments,
    bagsMilling: fromDecimal(row.bags_grinding),
    bagsMilledToday: fromDecimal(row.bags_ground_today),
    machinesRunning: row.machines_running,
    machinesInService: row.machines_in_service,
  }));
}

export function millingOf(
  rows: readonly ProjectMillingSummary[],
  project: ProjectId,
): MillingSummary {
  return rowOfProject(rows, project) ?? noMilling;
}

const BACKLOG_BAGS = 50;

export function isBacklogged(bagsWaiting: number): boolean {
  return bagsWaiting >= BACKLOG_BAGS;
}

export function combineSummaries(summaries: readonly MillingSummary[]): MillingSummary {
  return summaries.reduce<MillingSummary>(
    (total, summary) => ({
      bagsWaiting: total.bagsWaiting + summary.bagsWaiting,
      waitingShipments: total.waitingShipments + summary.waitingShipments,
      bagsMilling: total.bagsMilling + summary.bagsMilling,
      bagsMilledToday: total.bagsMilledToday + summary.bagsMilledToday,
      machinesRunning: total.machinesRunning + summary.machinesRunning,
      machinesInService: total.machinesInService + summary.machinesInService,
    }),
    noMilling,
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

export const MERCURY_MIN_GRAMS = 100;

export function createMercurySchema(messages: { required: string; quantityTooLow: string }) {
  return z.object({
    quantity: z
      .number({ error: messages.required })
      .min(MERCURY_MIN_GRAMS, messages.quantityTooLow),
  });
}

export type MercuryValues = z.infer<ReturnType<typeof createMercurySchema>>;

export function createMercuryAdditionSchema(messages: { quantityInvalid: string }) {
  return z.object({
    quantity: z.number({ error: messages.quantityInvalid }).positive(messages.quantityInvalid),
    notes: z.string().trim().max(500),
  });
}

export type MercuryAdditionValues = z.infer<ReturnType<typeof createMercuryAdditionSchema>>;

export function mercuryTotalAfter(total: number, quantity: number): number | undefined {
  return Number.isFinite(quantity) && quantity > 0 ? total + quantity : undefined;
}
