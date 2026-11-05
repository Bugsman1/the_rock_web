import type { ApiSchema } from "@/lib/api/client";
import { fromDecimal } from "@/lib/format";
import type { ProjectId } from "@/lib/projects";
import type { ShipmentRecord, ShipmentStatusKey } from "@/lib/shipments";

type ClientBags = {
  name: string;
  bagCount: number;
};

export const storedStatuses = [
  "pending",
  "grinding",
  "refining",
] as const satisfies readonly ShipmentStatusKey[];

export function storedShipments(
  records: readonly ShipmentRecord[],
  project?: ProjectId,
): readonly ShipmentRecord[] {
  return records.filter(
    (record) =>
      storedStatuses.some((status) => status === record.status) &&
      record.remainingBags > 0 &&
      (project === undefined || record.project === project),
  );
}

export function shipmentsOfProject<Shipment extends ShipmentRecord>(
  records: readonly Shipment[],
  project: ProjectId,
): readonly Shipment[] {
  return records.filter((record) => record.project === project);
}

export function bagCount(records: readonly ShipmentRecord[]): number {
  return records.reduce((total, record) => total + record.remainingBags, 0);
}

export function clientBags(records: readonly ShipmentRecord[]): readonly ClientBags[] {
  const totals = new Map<string, number>();

  for (const record of records) {
    totals.set(record.customerName, (totals.get(record.customerName) ?? 0) + record.remainingBags);
  }

  return [...totals].map(([name, bags]) => ({ name, bagCount: bags }));
}

export type TopCustomer = {
  id: string;
  name: string;
  bags: number;
  percentage: number;
};

export type ProjectTopCustomers = {
  project: ProjectId;
  customers: readonly TopCustomer[];
};

export function topCustomersFromApi(
  rows: readonly ApiSchema<"ProjectTopCustomersByBags">[],
): readonly ProjectTopCustomers[] {
  return rows.map((row) => ({
    project: String(row.project),
    customers: row.results.map((customer) => ({
      id: String(customer.id),
      name: customer.full_name,
      bags: fromDecimal(customer.bags),
      percentage: fromDecimal(customer.percentage),
    })),
  }));
}

export function topCustomersOf(
  rows: readonly ProjectTopCustomers[],
  project: ProjectId,
): readonly TopCustomer[] {
  return rows.find((row) => row.project === project)?.customers ?? [];
}
