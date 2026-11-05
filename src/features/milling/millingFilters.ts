import type { GroupChoices, ListQuery } from "@/lib/filters";
import type { GrindingListFilter } from "@/lib/grindingApi";
import type { ProjectId } from "@/lib/projects";
import type { ShipmentListFilter } from "@/lib/shipmentsApi";
import { millingStatuses } from "./milling";

export const runStates = ["running", "done"] as const;

export const machineHistoryGroups: GroupChoices = { runState: runStates };

export const queueGroups: GroupChoices = { status: millingStatuses };

function chosen(list: ListQuery, group: string): readonly string[] {
  return list.filters.selection[group] ?? [];
}

function clientAndDates(list: ListQuery) {
  const { client, from, to } = list.filters;

  return {
    ...(client === "" ? {} : { customer: client }),
    ...(from === "" ? {} : { from }),
    ...(to === "" ? {} : { to }),
  };
}

export function millingQueueFilter(project: ProjectId, list: ListQuery): ShipmentListFilter {
  const picked = millingStatuses.filter((status) => chosen(list, "status").includes(status));
  const { customer } = clientAndDates(list);

  return {
    project,
    statuses: picked.length === 0 ? millingStatuses : picked,
    ordering: "arrival_date",
    search: list.search,
    withBagsLeft: true,
    ...(customer === undefined ? {} : { customer }),
  };
}

export function machineHistoryFilter(
  project: ProjectId,
  grinder: string,
  list: ListQuery,
): GrindingListFilter {
  const states = chosen(list, "runState");
  const { customer, from, to } = clientAndDates(list);

  return {
    project,
    grinder,
    ordering: "-start_time",
    search: list.search,
    ...(states.length === 1 ? { running: states[0] === "running" } : {}),
    ...(customer === undefined ? {} : { customer }),
    ...(from === undefined ? {} : { startedFrom: from }),
    ...(to === undefined ? {} : { startedTo: to }),
  };
}
