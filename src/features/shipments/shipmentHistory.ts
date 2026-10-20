import { isIsoDate } from "@/lib/datetime";
import { matchesSearch } from "@/lib/search";
import type { ShipmentRecord } from "@/lib/shipments";

export type HistoryFilter = {
  from: string;
  to: string;
  query: string;
};

export const emptyHistoryFilter: HistoryFilter = { from: "", to: "", query: "" };

export function isFilterActive(filter: HistoryFilter): boolean {
  return filter.from !== "" || filter.to !== "" || filter.query.trim() !== "";
}

function arrivalDay(record: ShipmentRecord): string {
  return record.arrivedAt.slice(0, 10);
}

export function matchesQuery(record: ShipmentRecord, query: string): boolean {
  return matchesSearch(
    { texts: [record.customerName, record.shipmentNumber], phone: record.phone },
    query,
  );
}

export function filterShipments(
  records: readonly ShipmentRecord[],
  filter: HistoryFilter,
): readonly ShipmentRecord[] {
  const from = isIsoDate(filter.from) ? filter.from : undefined;
  const to = isIsoDate(filter.to) ? filter.to : undefined;

  return records
    .filter((record) => from === undefined || arrivalDay(record) >= from)
    .filter((record) => to === undefined || arrivalDay(record) <= to)
    .filter((record) => matchesQuery(record, filter.query))
    .sort((a, b) => b.arrivedAt.localeCompare(a.arrivedAt));
}

export function completedShipments(records: readonly ShipmentRecord[]): readonly ShipmentRecord[] {
  return records.filter((record) => record.status === "completed");
}
