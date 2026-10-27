import { isIsoDate } from "@/lib/datetime";
import { isSamePhone } from "@/lib/phone";
import type { ShipmentRecord } from "@/lib/shipments";

export type HistoryFilter = {
  from: string;
  to: string;
  clientPhone: string;
};

export type HistoryClient = {
  name: string;
  phone: string;
};

export const emptyHistoryFilter: HistoryFilter = { from: "", to: "", clientPhone: "" };

export function isFilterActive(filter: HistoryFilter): boolean {
  return filter.from !== "" || filter.to !== "" || filter.clientPhone !== "";
}

export function historyClients(records: readonly ShipmentRecord[]): readonly HistoryClient[] {
  return records
    .reduce<HistoryClient[]>(
      (clients, record) =>
        clients.some((client) => isSamePhone(client.phone, record.phone))
          ? clients
          : [...clients, { name: record.customerName, phone: record.phone }],
      [],
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

function arrivalDay(record: ShipmentRecord): string {
  return record.arrivedAt.slice(0, 10);
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
    .filter((record) => filter.clientPhone === "" || isSamePhone(record.phone, filter.clientPhone))
    .sort((a, b) => b.arrivedAt.localeCompare(a.arrivedAt));
}

export function finishedShipments(records: readonly ShipmentRecord[]): readonly ShipmentRecord[] {
  return records.filter((record) => record.status === "completed" || record.status === "cancelled");
}
