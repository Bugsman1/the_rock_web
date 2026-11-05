import { isIsoDate } from "./datetime";

export type FilterOption<Row> = {
  value: string;
  matches: (row: Row) => boolean;
};

export type FilterGroup<Row> = {
  key: string;
  options: readonly FilterOption<Row>[];
};

export type FilterFields<Row> = {
  groups: readonly FilterGroup<Row>[];
  matchesClient?: (row: Row, client: string) => boolean;
  dateOf?: (row: Row) => string;
};

export type FilterState = {
  selection: Readonly<Record<string, readonly string[]>>;
  client: string;
  from: string;
  to: string;
};

export const noFilters: FilterState = { selection: {}, client: "", from: "", to: "" };

function chosenIn(state: FilterState, group: string): readonly string[] {
  return state.selection[group] ?? [];
}

function matchesGroup<Row>(row: Row, group: FilterGroup<Row>, state: FilterState): boolean {
  const chosen = chosenIn(state, group.key);

  return (
    chosen.length === 0 ||
    group.options.some((option) => chosen.includes(option.value) && option.matches(row))
  );
}

export function isWithinDays(timestamp: string, from: string, to: string): boolean {
  const day = timestamp.slice(0, 10);

  return (!isIsoDate(from) || day >= from) && (!isIsoDate(to) || day <= to);
}

function matchesClientAndDates<Row>(row: Row, fields: FilterFields<Row>, state: FilterState) {
  const { matchesClient, dateOf } = fields;

  return (
    (state.client === "" || matchesClient === undefined || matchesClient(row, state.client)) &&
    (dateOf === undefined || isWithinDays(dateOf(row), state.from, state.to))
  );
}

export function matchesFilters<Row>(
  row: Row,
  fields: FilterFields<Row>,
  state: FilterState,
): boolean {
  return (
    matchesClientAndDates(row, fields, state) &&
    fields.groups.every((group) => matchesGroup(row, group, state))
  );
}

export function toggleFilter(
  state: FilterState,
  group: string,
  value: string,
  single = false,
): FilterState {
  const chosen = chosenIn(state, group);
  const others = single ? [] : chosen.filter((current) => current !== value);

  return {
    ...state,
    selection: {
      ...state.selection,
      [group]: chosen.includes(value) ? others : [...others, value],
    },
  };
}

export function activeFilterCount(state: FilterState): number {
  const chosen = Object.values(state.selection).reduce((total, values) => total + values.length, 0);
  const dates = state.from !== "" || state.to !== "" ? 1 : 0;

  return chosen + (state.client === "" ? 0 : 1) + dates;
}

export type ListQuery = {
  search: string;
  filters: FilterState;
};

export type GroupChoices = Readonly<Record<string, readonly string[]>>;

const RECORD_ID = /^\d+$/;

export function listQueryFromParams(params: URLSearchParams, groups: GroupChoices): ListQuery {
  const client = params.get("client") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";

  return {
    search: (params.get("q") ?? "").trim(),
    filters: {
      selection: Object.fromEntries(
        Object.entries(groups).map(([group, allowed]) => [
          group,
          (params.get(group) ?? "").split(",").filter((value) => allowed.includes(value)),
        ]),
      ),
      client: RECORD_ID.test(client) ? client : "",
      from: isIsoDate(from) ? from : "",
      to: isIsoDate(to) ? to : "",
    },
  };
}

export function listQueryParams({ search, filters }: ListQuery): URLSearchParams {
  const params = new URLSearchParams();

  if (search !== "") params.set("q", search);
  for (const [group, values] of Object.entries(filters.selection)) {
    if (values.length > 0) params.set(group, values.join(","));
  }
  if (filters.client !== "") params.set("client", filters.client);
  if (isIsoDate(filters.from)) params.set("from", filters.from);
  if (isIsoDate(filters.to)) params.set("to", filters.to);

  return params;
}

export function isFiltered({ search, filters }: ListQuery): boolean {
  return search !== "" || activeFilterCount(filters) > 0;
}

export const FILTER_PAGE_PARAM = "filters";

function withoutFilterPage(url: URL): string {
  const params = new URLSearchParams(url.search);
  params.delete(FILTER_PAGE_PARAM);
  params.sort();

  return `${url.pathname}?${params}`;
}

export function onlyFilterPageToggled(current: URL, next: URL): boolean {
  return (
    current.searchParams.get(FILTER_PAGE_PARAM) !== next.searchParams.get(FILTER_PAGE_PARAM) &&
    withoutFilterPage(current) === withoutFilterPage(next)
  );
}
