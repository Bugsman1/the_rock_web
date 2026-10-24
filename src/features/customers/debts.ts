import { z } from "zod";
import type { ApiSchema, BackendFieldErrors, FieldErrors } from "@/lib/api/client";
import { fromDecimal, toMoneyDecimal } from "@/lib/format";
import type { IsoTimestamp } from "@/lib/format";

export type DebtStatus = ApiSchema<"DebtStatusEnum">;

export type DebtHistoryEntry = {
  key: string;
  type: ApiSchema<"TypeEnum">;
  date: IsoTimestamp;
  amount: number;
  text: string;
  byName: string;
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
    byName: entry.created_by_name ?? "",
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
  messages: { amountInvalid: string; amountTooHigh: string },
  remaining: number,
) {
  return z.object({
    amount: amountSchema(messages.amountInvalid).max(remaining, messages.amountTooHigh),
    notes: z.string().max(NOTES_MAX_LENGTH),
  });
}

export type PaymentValues = z.infer<ReturnType<typeof createPaymentSchema>>;

export function newDebtToApi(customerId: string, values: NewDebtValues) {
  return {
    customer: Number(customerId),
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
    amount: toMoneyDecimal(values.amount),
    notes: values.notes.trim(),
  };
}

export function newDebtErrorsFromApi(errors: BackendFieldErrors): FieldErrors<keyof NewDebtValues> {
  return {
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
    ...(errors.amount === undefined ? {} : { amount: errors.amount }),
    ...(errors.notes === undefined ? {} : { notes: errors.notes }),
  };
}
