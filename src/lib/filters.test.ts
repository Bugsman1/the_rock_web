import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  isFiltered,
  listQueryFromParams,
  listQueryParams,
  isWithinDays,
  matchesFilters,
  noFilters,
  onlyFilterPageToggled,
  toggleFilter,
} from "./filters";
import type { FilterFields } from "./filters";

type Row = { client: string; color: string; size: string; day: string };

const rows: readonly Row[] = [
  { client: "Ali", color: "red", size: "small", day: "2026-10-01T08:00:00Z" },
  { client: "Ali", color: "blue", size: "large", day: "2026-10-05T08:00:00Z" },
  { client: "Sidi", color: "red", size: "large", day: "2026-10-09T08:00:00Z" },
];

const option = (key: keyof Row, value: string) => ({
  value,
  matches: (row: Row) => row[key] === value,
});

const fields: FilterFields<Row> = {
  groups: [
    { key: "color", options: [option("color", "red"), option("color", "blue")] },
    { key: "size", options: [option("size", "small"), option("size", "large")] },
  ],
  matchesClient: (row, client) => row.client === client,
  dateOf: (row) => row.day,
};

function shown(state: typeof noFilters) {
  return rows.filter((row) => matchesFilters(row, fields, state));
}

describe("filters", () => {
  it("keeps every row with no filter chosen", () => {
    expect(shown(noFilters)).toEqual(rows);
    expect(activeFilterCount(noFilters)).toBe(0);
  });

  it("keeps a row matching any choice of a group, and every group together", () => {
    const red = toggleFilter(noFilters, "color", "red");
    const redOrBlue = toggleFilter(red, "color", "blue");
    const redOrBlueLarge = toggleFilter(redOrBlue, "size", "large");

    expect(shown(red)).toEqual([rows[0], rows[2]]);
    expect(shown(redOrBlue)).toEqual(rows);
    expect(shown(redOrBlueLarge)).toEqual([rows[1], rows[2]]);
    expect(activeFilterCount(redOrBlueLarge)).toBe(3);
  });

  it("removes a choice when it is toggled again", () => {
    const state = toggleFilter(toggleFilter(noFilters, "color", "red"), "color", "red");

    expect(shown(state)).toEqual(rows);
    expect(activeFilterCount(state)).toBe(0);
  });

  it("adds the client and the dates to the choices", () => {
    const state = { ...toggleFilter(noFilters, "color", "red"), client: "Ali" };

    expect(shown(state)).toEqual([rows[0]]);
    expect(shown({ ...noFilters, from: "2026-10-05", to: "2026-10-09" })).toEqual([
      rows[1],
      rows[2],
    ]);
    expect(activeFilterCount({ ...state, from: "2026-10-05", to: "2026-10-09" })).toBe(3);
  });

  it("keeps one choice only in a single-choice group", () => {
    const truck = toggleFilter(noFilters, "transport", "truck", true);

    expect(toggleFilter(truck, "transport", "hilux", true).selection.transport).toEqual(["hilux"]);
    expect(toggleFilter(truck, "transport", "truck", true).selection.transport).toEqual([]);
  });

  it("takes the days from and to, both included, and ignores an unfinished date", () => {
    expect(isWithinDays("2026-10-05T23:00:00Z", "2026-10-05", "2026-10-05")).toBe(true);
    expect(isWithinDays("2026-10-04T23:00:00Z", "2026-10-05", "")).toBe(false);
    expect(isWithinDays("2026-10-04T23:00:00Z", "2026-10", "")).toBe(true);
  });
});

describe("list query", () => {
  const groups = { status: ["pending", "grinding"], payment: ["paid", "unpaid"] };

  it("reads the search, the known choices, the client and the dates", () => {
    const list = listQueryFromParams(
      new URLSearchParams(
        "q=%20SH-1%20&status=grinding,lost&payment=paid&client=7&from=2026-10-01&to=bad",
      ),
      groups,
    );

    expect(list).toEqual({
      search: "SH-1",
      filters: {
        selection: { status: ["grinding"], payment: ["paid"] },
        client: "7",
        from: "2026-10-01",
        to: "",
      },
    });
    expect(isFiltered(list)).toBe(true);
  });

  it("refuses a client that is not an id", () => {
    const list = listQueryFromParams(new URLSearchParams("client=Ali"), groups);

    expect(list.filters.client).toBe("");
    expect(isFiltered(list)).toBe(false);
  });

  it("writes back only what differs from the default, the choices comma-separated", () => {
    const list = listQueryFromParams(
      new URLSearchParams("status=pending,grinding&client=7"),
      groups,
    );

    expect(listQueryParams(list).toString()).toBe("status=pending%2Cgrinding&client=7");
    expect(listQueryParams({ ...list, filters: noFilters }).toString()).toBe("");
  });
});

describe("onlyFilterPageToggled", () => {
  const at = (path: string) => new URL(path, "http://app.test");

  it("is true when only the filter page opens or closes", () => {
    expect(onlyFilterPageToggled(at("/p?q=a&status=x"), at("/p?status=x&q=a&filters=1"))).toBe(
      true,
    );
    expect(onlyFilterPageToggled(at("/p?q=a&filters=1"), at("/p?q=a"))).toBe(true);
  });

  it("is false when the list or the page changes, or when the same address reloads", () => {
    expect(onlyFilterPageToggled(at("/p?filters=1"), at("/p?status=x"))).toBe(false);
    expect(onlyFilterPageToggled(at("/p"), at("/o?filters=1"))).toBe(false);
    expect(onlyFilterPageToggled(at("/p?q=a"), at("/p?q=a"))).toBe(false);
  });
});
