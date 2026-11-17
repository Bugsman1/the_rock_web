import { parsePageNumber } from "@/lib/api/pagination";
import { isIsoDate } from "@/lib/datetime";
import type { FilterState } from "@/lib/filters";
import { isRecordId } from "@/lib/projects";
import { categoryValueOf, isTransactionType } from "./cash";
import type { CashCategory } from "./cash";
import type { TransactionType } from "@/lib/cashTransactions";

type Category = CashCategory["value"];

export type CashFilter = {
  search: string;
  type: TransactionType | undefined;
  categories: readonly Category[];
  customer: string;
  supplier: string;
  from: string;
  to: string;
};

export type CashDrawer =
  | { kind: "new"; type: TransactionType }
  | { kind: "view"; id: string }
  | { kind: "edit"; id: string }
  | { kind: "delete"; id: string };

export type CashQuery = CashFilter & { page: number; drawer: CashDrawer | undefined };

function idOrEmpty(value: string | null | undefined): string {
  return value !== null && value !== undefined && isRecordId(value) ? value : "";
}

function drawerOf(params: URLSearchParams): CashDrawer | undefined {
  const type = params.get("new") ?? "";
  const view = idOrEmpty(params.get("view"));
  const edit = idOrEmpty(params.get("edit"));
  const remove = idOrEmpty(params.get("delete"));

  if (isTransactionType(type)) return { kind: "new", type };
  if (view !== "") return { kind: "view", id: view };
  if (edit !== "") return { kind: "edit", id: edit };
  if (remove !== "") return { kind: "delete", id: remove };

  return undefined;
}

function dateOrEmpty(value: string | null): string {
  return value !== null && isIsoDate(value) ? value : "";
}

export function cashQueryFromParams(params: URLSearchParams): CashQuery {
  const type = params.get("type") ?? "";

  return {
    search: (params.get("q") ?? "").trim(),
    type: isTransactionType(type) ? type : undefined,
    categories: (params.get("category") ?? "").split(",").flatMap((value) => {
      const category = categoryValueOf(value);
      return category === undefined ? [] : [category];
    }),
    customer: idOrEmpty(params.get("customer")),
    supplier: idOrEmpty(params.get("supplier")),
    from: dateOrEmpty(params.get("from")),
    to: dateOrEmpty(params.get("to")),
    page: parsePageNumber(params.get("page")),
    drawer: drawerOf(params),
  };
}

function drawerParams(drawer: CashDrawer | undefined): readonly (readonly [string, string])[] {
  if (drawer === undefined) return [];
  if (drawer.kind === "new") return [["new", drawer.type]];

  return [[drawer.kind, drawer.id]];
}

export function cashQueryParams(
  query: CashFilter & { page?: number; drawer?: CashDrawer | undefined },
): URLSearchParams {
  const params = new URLSearchParams();
  const values: readonly (readonly [string, string | undefined])[] = [
    ["q", query.search],
    ["type", query.type],
    ["category", query.categories.join(",")],
    ["customer", query.customer],
    ["supplier", query.supplier],
    ["from", query.from],
    ["to", query.to],
    ["page", query.page !== undefined && query.page > 1 ? String(query.page) : undefined],
    ...drawerParams(query.drawer),
  ];

  for (const [name, value] of values) {
    if (value !== undefined && value !== "") params.set(name, value);
  }

  return params;
}

export function cashFilterState(filter: CashFilter): FilterState {
  const chosen = (value: string | undefined) =>
    value === undefined || value === "" ? [] : [value];

  return {
    selection: {
      type: chosen(filter.type),
      category: filter.categories,
      supplier: chosen(filter.supplier),
    },
    client: filter.customer,
    from: filter.from,
    to: filter.to,
  };
}

export function cashFilterFromState(search: string, state: FilterState): CashFilter {
  const first = (key: string) => state.selection[key]?.[0] ?? "";

  return cashQueryFromParams(
    new URLSearchParams({
      q: search,
      type: first("type"),
      category: (state.selection.category ?? []).join(","),
      customer: state.client,
      supplier: first("supplier"),
      from: state.from,
      to: state.to,
    }),
  );
}

export function isCashFiltered(filter: CashFilter): boolean {
  return (
    filter.search !== "" ||
    filter.type !== undefined ||
    filter.categories.length > 0 ||
    [filter.customer, filter.supplier, filter.from, filter.to].some((value) => value !== "")
  );
}
