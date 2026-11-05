import type { GroupChoices, ListQuery } from "@/lib/filters";
import type { ProjectId } from "@/lib/projects";
import type { ShipmentStatusKey } from "@/lib/shipments";
import type { ShipmentListFilter } from "@/lib/shipmentsApi";
import { transportMethodKeys } from "./shipments";

export const historyStatuses = ["completed", "cancelled"] as const;

const paymentChoices = ["unpaid", "paid"] as const;

export function shipmentGroupChoices(statuses: readonly ShipmentStatusKey[]): GroupChoices {
  return { status: statuses, payment: paymentChoices, transport: transportMethodKeys };
}

export function shipmentListFilter(
  project: ProjectId,
  list: ListQuery,
  statuses: readonly ShipmentStatusKey[],
  ordering: ShipmentListFilter["ordering"],
): ShipmentListFilter {
  const chosen = (group: string) => list.filters.selection[group] ?? [];
  const picked = statuses.filter((status) => chosen("status").includes(status));
  const payment = chosen("payment");
  const transport = transportMethodKeys.find((method) => chosen("transport").includes(method));
  const { client, from, to } = list.filters;

  return {
    project,
    statuses: picked.length === 0 ? statuses : picked,
    ordering,
    search: list.search,
    ...(client === "" ? {} : { customer: client }),
    ...(from === "" ? {} : { arrivedFrom: from }),
    ...(to === "" ? {} : { arrivedTo: to }),
    ...(payment.length === 1 ? { fullyPaid: payment[0] === "paid" } : {}),
    ...(transport === undefined ? {} : { transport }),
  };
}
