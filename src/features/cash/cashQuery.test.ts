import { describe, expect, it } from "vitest";
import {
  cashFilterFromState,
  cashFilterState,
  cashQueryFromParams,
  cashQueryParams,
  isCashFiltered,
} from "./cashQuery";

const address =
  "q=gasoil&type=expense&category=fuel,wages&customer=7&supplier=5&from=2026-11-01&to=2026-11-30&page=2";

describe("cashQueryFromParams", () => {
  it("reads the search, the filters, the page and the drawer from the address", () => {
    expect(cashQueryFromParams(new URLSearchParams(`${address}&edit=9`))).toEqual({
      search: "gasoil",
      type: "expense",
      categories: ["fuel", "wages"],
      customer: "7",
      supplier: "5",
      from: "2026-11-01",
      to: "2026-11-30",
      page: 2,
      drawer: { kind: "edit", id: "9" },
    });
  });

  it("drops anything it does not know", () => {
    expect(
      cashQueryFromParams(
        new URLSearchParams(
          "type=gift&category=bonus&customer=../7&from=hier&new=transfer&delete=x",
        ),
      ),
    ).toMatchObject({
      type: undefined,
      categories: [],
      customer: "",
      from: "",
      drawer: undefined,
    });
  });

  it("opens a new income or expense form", () => {
    expect(cashQueryFromParams(new URLSearchParams("new=income")).drawer).toEqual({
      kind: "new",
      type: "income",
    });
  });
});

describe("cashQueryParams", () => {
  it("writes back the same address, leaving out what is empty", () => {
    const query = cashQueryFromParams(new URLSearchParams(address));

    expect(Object.fromEntries(cashQueryParams(query))).toEqual(
      Object.fromEntries(new URLSearchParams(address)),
    );
    expect(
      cashQueryParams({ ...query, page: 1, drawer: { kind: "delete", id: "9" } }).get("delete"),
    ).toBe("9");
    expect(cashQueryParams({ ...query, page: 1 }).has("page")).toBe(false);
  });
});

describe("cash filters", () => {
  it("turns the filters into the filter menu's choices and back", () => {
    const query = cashQueryFromParams(new URLSearchParams(address));
    const state = cashFilterState(query);

    expect(state).toEqual({
      selection: {
        type: ["expense"],
        category: ["fuel", "wages"],
        supplier: ["5"],
      },
      client: "7",
      from: "2026-11-01",
      to: "2026-11-30",
    });
    expect(cashFilterFromState("gasoil", state)).toMatchObject({
      search: "gasoil",
      type: "expense",
      categories: ["fuel", "wages"],
      customer: "7",
      page: 1,
      drawer: undefined,
    });
  });

  it("says whether any search or filter is on", () => {
    expect(isCashFiltered(cashQueryFromParams(new URLSearchParams("page=3")))).toBe(false);
    expect(isCashFiltered(cashQueryFromParams(new URLSearchParams("type=income")))).toBe(true);
  });
});
