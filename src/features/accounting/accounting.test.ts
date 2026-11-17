import { describe, expect, it } from "vitest";
import {
  currentMonth,
  periodFromParams,
  periodParams,
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

describe("periodParams", () => {
  it("writes the period in the address", () => {
    expect(periodParams({ from: "2026-11-01", to: "2026-11-30" }).toString()).toBe(
      "from=2026-11-01&to=2026-11-30",
    );
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
        total_returns: "0.00",
        total_losses: "0.00",
      }),
    ).toEqual({ project: "4", income: 0, expense: 3000, netProfit: -3000 });
    expect(
      profitAndLossFromApi({
        income: [{ category: "grinding_income", label: "Broyage", amount: "90000.00" }],
        expenses: [],
        total_income: "90000.00",
        total_expense: "0.00",
        net_profit: "90000.00",
        total_returns: "0.00",
        total_losses: "0.00",
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

  it("reads the summary's figures and the movements waiting for approval", () => {
    expect(
      summaryFromApi({
        total_income: "90000.00",
        total_expense: "20000.00",
        net_profit: "70000.00",
        total_returns: "60000.00",
        total_losses: "5000.00",
        receivables: "0.00",
        payables: "0.00",
        supplier_advances: "0.00",
        capital: "0.00",
        cash_balance: "0.00",
        unapproved_transactions: 2,
      }),
    ).toEqual({
      income: 90000,
      expense: 20000,
      netProfit: 70000,
      returns: 60000,
      losses: 5000,
      unapproved: 2,
    });
  });
});
