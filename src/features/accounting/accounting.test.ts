import { describe, expect, it } from "vitest";
import {
  accountingQueryFromParams,
  accountingQueryParams,
  currentMonth,
  groupedFromApi,
  periodFromParams,
  profitAndLossFromApi,
  projectProfitFromApi,
  summaryFromApi,
} from "./accounting";

const now = new Date("2026-11-16T10:00:00Z");

describe("currentMonth", () => {
  it("runs from the first to the last day of this month", () => {
    expect(currentMonth(now)).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(currentMonth(new Date("2028-02-10T10:00:00Z"))).toEqual({
      from: "2028-02-01",
      to: "2028-02-29",
    });
  });
});

describe("periodFromParams", () => {
  it("reads a period from the address, else the current month", () => {
    expect(periodFromParams(new URLSearchParams("from=2026-01-01&to=2026-06-30"), now)).toEqual({
      from: "2026-01-01",
      to: "2026-06-30",
    });
    expect(periodFromParams(new URLSearchParams("from=hier&to=2026-06-30"), now)).toEqual({
      from: "2026-11-01",
      to: "2026-11-30",
    });
  });
});

describe("accounting query", () => {
  it("reads the groupings, falling back on the category", () => {
    expect(
      accountingQueryFromParams(new URLSearchParams("income=customer&expenses=wizard"), now),
    ).toEqual({ from: "2026-11-01", to: "2026-11-30", income: "customer", expenses: "category" });
  });

  it("writes the period and only the groupings that are not the category", () => {
    expect(
      accountingQueryParams({
        from: "2026-11-01",
        to: "2026-11-30",
        income: "category",
        expenses: "supplier",
      }).toString(),
    ).toBe("from=2026-11-01&to=2026-11-30&expenses=supplier");
  });
});

describe("report mapping", () => {
  it("reads the backend's amounts as numbers", () => {
    expect(
      projectProfitFromApi({
        project: 4,
        project_name: "Sfariyat 1",
        project_site: "sfariyat",
        income: "0.00",
        expense: "3000.00",
        net_profit: "-3000.00",
      }),
    ).toEqual({ project: "4", income: 0, expense: 3000, netProfit: -3000 });
    expect(
      profitAndLossFromApi({
        income: [{ category: "grinding_income", label: "Broyage", amount: "90000.00" }],
        expenses: [],
        total_income: "90000.00",
        total_expense: "0.00",
        net_profit: "90000.00",
        by_project: [],
      }),
    ).toEqual({
      income: [{ key: "grinding_income", label: "Broyage", amount: 90000 }],
      expenses: [],
      totalIncome: 90000,
      totalExpense: 0,
      netProfit: 90000,
    });
  });

  it("keeps a group without a reference apart", () => {
    expect(
      groupedFromApi({
        group_by: "supplier",
        rows: [
          { key: null, label: "غير محدد", amount: "500.00", count: 1 },
          { key: "5", label: "Sidi", amount: "1500.00", count: 2 },
        ],
        total: "2000.00",
        count: 3,
      }),
    ).toEqual({
      rows: [
        { key: "none-0", label: "غير محدد", amount: 500, count: 1 },
        { key: "5", label: "Sidi", amount: 1500, count: 2 },
      ],
      total: 2000,
    });
  });

  it("reads the summary's figures and the movements waiting for approval", () => {
    expect(
      summaryFromApi({
        total_income: "90000.00",
        total_expense: "20000.00",
        net_profit: "70000.00",
        receivables: "0.00",
        payables: "0.00",
        supplier_advances: "0.00",
        capital: "0.00",
        cash_balance: "0.00",
        unapproved_transactions: 2,
      }),
    ).toEqual({ income: 90000, expense: 20000, netProfit: 70000, unapproved: 2 });
  });
});
