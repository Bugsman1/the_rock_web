import type { ApiSchema } from "@/lib/api/client";
import { fromDecimal } from "@/lib/format";
import { rowOfProject } from "@/lib/projects";
import type { ProjectId } from "@/lib/projects";
import type { ShipmentStatusKey } from "@/lib/shipments";

export const storedStatuses = [
  "pending",
  "grinding",
  "refining",
] as const satisfies readonly ShipmentStatusKey[];

type StorageSummary = {
  customers: number;
  bags: number;
};

export type ProjectStorage = StorageSummary & {
  project: ProjectId;
};

export function storageFromApi(
  rows: readonly ApiSchema<"ProjectStorageSummary">[],
): readonly ProjectStorage[] {
  return rows.map((row) => ({
    project: String(row.project),
    customers: row.customers_with_bags,
    bags: fromDecimal(row.bags_in_storage),
  }));
}

export function storageOf(rows: readonly ProjectStorage[], project: ProjectId): StorageSummary {
  return rowOfProject(rows, project) ?? { customers: 0, bags: 0 };
}

export function bagsInStorage(rows: readonly StorageSummary[]): number {
  return rows.reduce((total, row) => total + row.bags, 0);
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
  return rowOfProject(rows, project)?.customers ?? [];
}
