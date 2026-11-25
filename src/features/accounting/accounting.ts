import { z } from "zod";
import type { ApiSchema, BackendFieldErrors, FieldErrors } from "@/lib/api/client";
import type { CashStatus, CashTransaction } from "@/lib/cashTransactions";
import { isIsoDate, todayAsInputValue } from "@/lib/datetime";
import { fromDecimal, toMoneyDecimal } from "@/lib/format";
import { isRecordId } from "@/lib/projects";

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
  returns: number;
  losses: number;
  unapproved: number;
};

export type PartyAmount = { id: string; name: string; amount: number };

export type Receivables = { customers: readonly PartyAmount[]; total: number };

export type Payables = {
  suppliers: readonly PartyAmount[];
  total: number;
  advances: readonly PartyAmount[];
  advancesTotal: number;
};

export type ShipmentReturn = {
  settlement: string;
  settlementNumber: string;
  customerName: string;
  shipment: string;
  shipmentNumber: string;
  totalCost: number;
  returnAmount: number | undefined;
  loss: number | undefined;
  cashStatus: CashStatus | undefined;
  locked: boolean;
};

export type AccountingDrawer =
  { kind: "reject"; id: string } | { kind: "return"; settlement: string; shipment: string };

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

export function isRefinersHalfOfPay(transaction: CashTransaction): boolean {
  return transaction.source === "refining" && transaction.cashBox === "refiners";
}

export function summaryFromApi(summary: ApiSchema<"FinancialSummary">): AccountingSummary {
  return {
    income: fromDecimal(summary.total_income),
    expense: fromDecimal(summary.total_expense),
    netProfit: fromDecimal(summary.net_profit),
    returns: fromDecimal(summary.total_returns),
    losses: fromDecimal(summary.total_losses),
    unapproved: summary.unapproved_transactions,
  };
}

export function receivablesFromApi(report: ApiSchema<"Receivables">): Receivables {
  return {
    customers: report.customers.map((row) => ({
      id: String(row.customer),
      name: row.customer_name,
      amount: fromDecimal(row.total),
    })),
    total: fromDecimal(report.total),
  };
}

function supplierAmountOf(row: ApiSchema<"SupplierAmount">): PartyAmount {
  return { id: String(row.supplier), name: row.supplier_name, amount: fromDecimal(row.amount) };
}

export function payablesFromApi(report: ApiSchema<"Payables">): Payables {
  return {
    suppliers: report.suppliers.map(supplierAmountOf),
    total: fromDecimal(report.total),
    advances: report.advances.map(supplierAmountOf),
    advancesTotal: fromDecimal(report.advances_total),
  };
}

function optionalAmount(value: string | null): number | undefined {
  return value === null ? undefined : fromDecimal(value);
}

export function shipmentReturnsFromApi(settlement: ApiSchema<"Settlement">): ShipmentReturn[] {
  return settlement.returns.map((row) => ({
    settlement: String(settlement.id),
    settlementNumber: settlement.number,
    customerName: settlement.customer_name,
    shipment: String(row.shipment),
    shipmentNumber: row.shipment_number,
    totalCost: fromDecimal(row.total_cost),
    returnAmount: optionalAmount(row.return_amount),
    loss: optionalAmount(row.loss),
    cashStatus: row.cash_status ?? undefined,
    locked: row.is_locked,
  }));
}

export function drawerFromParams(params: URLSearchParams): AccountingDrawer | undefined {
  const reject = params.get("reject") ?? "";
  const [settlement = "", shipment = ""] = (params.get("return") ?? "").split(":");

  if (isRecordId(reject)) return { kind: "reject", id: reject };
  if (isRecordId(settlement) && isRecordId(shipment)) {
    return { kind: "return", settlement, shipment };
  }

  return undefined;
}

export function drawerParams(period: Period, drawer: AccountingDrawer): URLSearchParams {
  const params = periodParams(period);

  if (drawer.kind === "reject") params.set("reject", drawer.id);
  else params.set("return", `${drawer.settlement}:${drawer.shipment}`);

  return params;
}

export function createReturnSchema(messages: { returnInvalid: string }, totalCost: number) {
  return z.object({
    returnAmount: z
      .number({ error: messages.returnInvalid })
      .min(0, messages.returnInvalid)
      .max(totalCost, messages.returnInvalid),
  });
}

export type ReturnValues = z.infer<ReturnType<typeof createReturnSchema>>;

export function returnToApi(values: ReturnValues) {
  return { return_amount: toMoneyDecimal(values.returnAmount) };
}

export function returnErrorsFromApi(errors: BackendFieldErrors): FieldErrors<keyof ReturnValues> {
  return errors.return_amount === undefined ? {} : { returnAmount: errors.return_amount };
}
