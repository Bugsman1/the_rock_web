import { z } from "zod";
import type { ApiSchema, BackendFieldErrors, FieldErrors } from "@/lib/api/client";
import type { FilterFields } from "@/lib/filters";
import { fromDecimal, toMoneyDecimal } from "@/lib/format";
import type { IsoTimestamp } from "@/lib/format";

export type DebtStatus = ApiSchema<"DebtStatusEnum">;

export type DebtHistoryEntry = {
  key: string;
  type: ApiSchema<"DebtHistoryEntryTypeEnum">;
  date: IsoTimestamp;
  amount: number;
  text: string;
  balance: number;
};

export type CustomerDebt = {
  id: string;
  description: string;
  incurredAt: IsoTimestamp;
  total: number;
  paid: number;
  remaining: number;
  status: DebtStatus;
};

const DEBT_TEXT_MAX_LENGTH = 200;

const NOTES_MAX_LENGTH = 1000;

export const debtStatuses: readonly DebtStatus[] = ["open", "partially_paid", "paid"];

export const debtFilterFields: FilterFields<CustomerDebt> = {
  groups: [
    {
      key: "status",
      options: debtStatuses.map((status) => ({
        value: status,
        matches: (debt) => debt.status === status,
      })),
    },
  ],
};

export function debtFromApi(debt: ApiSchema<"CustomerDebt">): CustomerDebt {
  return {
    id: String(debt.id),
    description: debt.description,
    incurredAt: debt.incurred_at ?? debt.created_at,
    total: fromDecimal(debt.total_amount),
    paid: fromDecimal(debt.paid_amount),
    remaining: fromDecimal(debt.remaining_amount),
    status: debt.status,
  };
}

export function debtHistoryFromApi(entry: ApiSchema<"DebtHistoryEntry">): DebtHistoryEntry {
  return {
    key: `${entry.type}-${entry.id}`,
    type: entry.type,
    date: entry.date,
    amount: fromDecimal(entry.amount),
    text: entry.text,
    balance: fromDecimal(entry.balance),
  };
}

export type DebtAction = "increase" | "decrease" | "payOff";

const everyAction: readonly DebtAction[] = ["increase", "decrease", "payOff"];

export function isDebtAction(value: string | null): value is DebtAction {
  return everyAction.some((action) => action === value);
}

export function debtActions(debt: CustomerDebt): readonly DebtAction[] {
  return debt.status === "paid" ? ["increase"] : everyAction;
}

function amountSchema(amountInvalid: string) {
  return z.number({ error: amountInvalid }).positive(amountInvalid);
}

function requiredText(required: string) {
  return z.string().trim().min(1, required).max(DEBT_TEXT_MAX_LENGTH);
}

export function createNewDebtSchema(messages: { required: string; amountInvalid: string }) {
  return z.object({
    project: z.string().min(1, messages.required),
    description: requiredText(messages.required),
    amount: amountSchema(messages.amountInvalid),
  });
}

export type NewDebtValues = z.infer<ReturnType<typeof createNewDebtSchema>>;

export function createIncreaseSchema(messages: { required: string; amountInvalid: string }) {
  return z.object({
    amount: amountSchema(messages.amountInvalid),
    reason: requiredText(messages.required),
  });
}

export type IncreaseValues = z.infer<ReturnType<typeof createIncreaseSchema>>;

export function createPaymentSchema(
  messages: { required: string; amountInvalid: string; amountTooHigh: string },
  remaining: number,
) {
  return z.object({
    project: z.string().min(1, messages.required),
    amount: amountSchema(messages.amountInvalid).max(remaining, messages.amountTooHigh),
    notes: z.string().max(NOTES_MAX_LENGTH),
  });
}

export type PaymentValues = z.infer<ReturnType<typeof createPaymentSchema>>;

export function newDebtToApi(customerId: string, values: NewDebtValues) {
  return {
    customer: Number(customerId),
    project: Number(values.project),
    description: values.description.trim(),
    original_amount: toMoneyDecimal(values.amount),
  };
}

export function increaseToApi(debtId: string, values: IncreaseValues) {
  return {
    debt: Number(debtId),
    amount: toMoneyDecimal(values.amount),
    reason: values.reason.trim(),
  };
}

export function paymentToApi(debtId: string, values: PaymentValues) {
  return {
    debt: Number(debtId),
    project: Number(values.project),
    amount: toMoneyDecimal(values.amount),
    notes: values.notes.trim(),
  };
}

export function newDebtErrorsFromApi(errors: BackendFieldErrors): FieldErrors<keyof NewDebtValues> {
  return {
    ...(errors.project === undefined ? {} : { project: errors.project }),
    ...(errors.description === undefined ? {} : { description: errors.description }),
    ...(errors.original_amount === undefined ? {} : { amount: errors.original_amount }),
  };
}

export function increaseErrorsFromApi(
  errors: BackendFieldErrors,
): FieldErrors<keyof IncreaseValues> {
  return {
    ...(errors.amount === undefined ? {} : { amount: errors.amount }),
    ...(errors.reason === undefined ? {} : { reason: errors.reason }),
  };
}

export function paymentErrorsFromApi(errors: BackendFieldErrors): FieldErrors<keyof PaymentValues> {
  return {
    ...(errors.project === undefined ? {} : { project: errors.project }),
    ...(errors.amount === undefined ? {} : { amount: errors.amount }),
    ...(errors.notes === undefined ? {} : { notes: errors.notes }),
  };
}

export type CustomerLoss = {
  key: string;
  settlementNumber: string;
  shipmentNumber: string;
  projectName: string;
  date: string;
  totalCost: number;
  returnAmount: number;
  loss: number;
};

export type CustomerLosses = {
  losses: readonly CustomerLoss[];
  totalCost: number;
  totalReturn: number;
  totalLoss: number;
};

export function lossesFromApi(report: ApiSchema<"CustomerLosses">): CustomerLosses {
  return {
    losses: report.losses.map((row) => ({
      key: `${String(row.settlement)}-${String(row.shipment)}`,
      settlementNumber: row.settlement_number,
      shipmentNumber: row.shipment_number,
      projectName: row.project_name,
      date: row.date,
      totalCost: fromDecimal(row.total_cost),
      returnAmount: fromDecimal(row.return_amount),
      loss: fromDecimal(row.loss),
    })),
    totalCost: fromDecimal(report.total_cost),
    totalReturn: fromDecimal(report.total_return),
    totalLoss: fromDecimal(report.total_loss),
  };
}
