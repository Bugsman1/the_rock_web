import { remainingBags } from "@/lib/grinding";
import type { MillingOperation } from "@/lib/grinding";
import type { ProjectId } from "@/lib/projects";
import type { ShipmentRecord, ShipmentStatusKey } from "@/lib/shipments";

type ClientBags = {
  name: string;
  bagCount: number;
};

const storedStatuses: readonly ShipmentStatusKey[] = ["pending", "grinding"];

export type StoredShipment = ShipmentRecord & { remainingBags: number };

const TOP_CLIENTS_LIMIT = 6;

export function isInStorage(record: ShipmentRecord): boolean {
  return storedStatuses.includes(record.status);
}

export function openShipments(
  records: readonly ShipmentRecord[],
  operations: readonly MillingOperation[],
  project?: ProjectId,
): readonly StoredShipment[] {
  return records
    .filter(
      (record) => isInStorage(record) && (project === undefined || record.project === project),
    )
    .map((record) => ({
      ...record,
      remainingBags: remainingBags(
        { shipmentNumber: record.shipmentNumber, bags: record.bagCount },
        operations,
      ),
    }));
}

export function storedShipments(
  records: readonly ShipmentRecord[],
  operations: readonly MillingOperation[],
  project?: ProjectId,
): readonly StoredShipment[] {
  return openShipments(records, operations, project).filter((record) => record.remainingBags > 0);
}

export function shipmentsOfProject<Shipment extends ShipmentRecord>(
  records: readonly Shipment[],
  project: ProjectId,
): readonly Shipment[] {
  return records.filter((record) => record.project === project);
}

export function bagCount(records: readonly StoredShipment[]): number {
  return records.reduce((total, record) => total + record.remainingBags, 0);
}

export function clientBags(records: readonly StoredShipment[]): readonly ClientBags[] {
  const totals = new Map<string, number>();

  for (const record of records) {
    totals.set(record.customerName, (totals.get(record.customerName) ?? 0) + record.remainingBags);
  }

  return [...totals].map(([name, bags]) => ({ name, bagCount: bags }));
}

export function topClientsByBags(
  clients: readonly ClientBags[],
  limit: number = TOP_CLIENTS_LIMIT,
): readonly ClientBags[] {
  return [...clients].sort((a, b) => b.bagCount - a.bagCount).slice(0, limit);
}

export function shipmentsByArrival<Shipment extends ShipmentRecord>(
  records: readonly Shipment[],
): readonly Shipment[] {
  return [...records].sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt));
}

export function bagShare(bags: number, largestBagCount: number): number {
  if (largestBagCount <= 0) return 0;

  return Math.min(100, Math.round((bags / largestBagCount) * 100));
}
