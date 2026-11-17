import type { ApiSchema } from "@/lib/api/client";
import { isIsoDate, todayAsInputValue } from "@/lib/datetime";
import { fromDecimal } from "@/lib/format";

export type Period = { from: string; to: string };

export type ProjectProfit = {
  project: string;
  income: number;
  expense: number;
  netProfit: number;
};

export type AccountAmount = { key: string; label: string; amount: number };

export type ProfitAndLoss = {
  income: readonly AccountAmount[];
  expenses: readonly AccountAmount[];
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
};

export type AccountingSummary = {
  income: number;
  expense: number;
  netProfit: number;
  unapproved: number;
};

export function currentMonth(now: Date): Period {
  const today = todayAsInputValue(now);
  const [year = "", month = ""] = today.split("-");
  const lastDay = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();

  return {
    from: `${year}-${month}-01`,
    to: `${year}-${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function periodFromParams(params: URLSearchParams, now: Date): Period {
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";

  return isIsoDate(from) && isIsoDate(to) ? { from, to } : currentMonth(now);
}

export function periodParams(period: Period): URLSearchParams {
  return new URLSearchParams({ from: period.from, to: period.to });
}

export function projectProfitFromApi(row: ApiSchema<"ProjectProfit">): ProjectProfit {
  return {
    project: String(row.project),
    income: fromDecimal(row.income),
    expense: fromDecimal(row.expense),
    netProfit: fromDecimal(row.net_profit),
  };
}

function amountFromApi(row: ApiSchema<"CategoryAmount">): AccountAmount {
  return { key: row.category, label: row.label, amount: fromDecimal(row.amount) };
}

export function profitAndLossFromApi(report: ApiSchema<"ProfitAndLoss">): ProfitAndLoss {
  return {
    income: report.income.map(amountFromApi),
    expenses: report.expenses.map(amountFromApi),
    totalIncome: fromDecimal(report.total_income),
    totalExpense: fromDecimal(report.total_expense),
    netProfit: fromDecimal(report.net_profit),
  };
}

export function summaryFromApi(summary: ApiSchema<"FinancialSummary">): AccountingSummary {
  return {
    income: fromDecimal(summary.total_income),
    expense: fromDecimal(summary.total_expense),
    netProfit: fromDecimal(summary.net_profit),
    unapproved: summary.unapproved_transactions,
  };
}
