import { z } from "zod";
import type { ApiSchema, BackendFieldErrors, FieldErrors } from "@/lib/api/client";
import { fromDecimal, toMoneyDecimal } from "@/lib/format";
import type { IsoTimestamp } from "@/lib/format";
import { requiredIsoDate, requiredTime } from "./employees";
import type { WithdrawalValues } from "./employees";

export type Debt = {
  id: string;
  amount: number;
  at: IsoTimestamp;
  description: string;
  paidBySalary: boolean;
  byName: string | null;
};

type DebtPaymentMethod = ApiSchema<"EmployeeDebtPayment">["method"];

export type DebtPayment = {
  id: string;
  amount: number;
  at: IsoTimestamp;
  method: DebtPaymentMethod;
  note: string;
  byName: string | null;
};

export type DebtLedgerEntry =
  | { kind: "debt"; id: string; at: IsoTimestamp; debt: Debt }
  | { kind: "payment"; id: string; at: IsoTimestamp; payment: DebtPayment };

const DESCRIPTION_MAX_LENGTH = 200;

export function createDebtSchema(messages: {
  required: string;
  dateInvalid: string;
  timeInvalid: string;
  amountInvalid: string;
}) {
  return z.object({
    amount: z.number({ error: messages.amountInvalid }).positive(messages.amountInvalid),
    date: requiredIsoDate(messages),
    time: requiredTime(messages),
    description: z.string().trim().min(1, messages.required).max(DESCRIPTION_MAX_LENGTH),
    paidBySalary: z.boolean(),
  });
}

export type DebtValues = z.infer<ReturnType<typeof createDebtSchema>>;

const debtFields: readonly (keyof DebtValues)[] = [
  "amount",
  "date",
  "time",
  "description",
  "paidBySalary",
];

export function isDebtField(value: string): value is keyof DebtValues {
  return debtFields.some((field) => field === value);
}

export function isEnteredByHand(payment: DebtPayment): boolean {
  return payment.method === "other";
}

export function debtLedger(
  debts: readonly Debt[],
  payments: readonly DebtPayment[],
): readonly DebtLedgerEntry[] {
  const entries = [
    ...debts.map((debt): DebtLedgerEntry => ({
      kind: "debt",
      id: `debt-${debt.id}`,
      at: debt.at,
      debt,
    })),
    ...payments.map((payment): DebtLedgerEntry => ({
      kind: "payment",
      id: `payment-${payment.id}`,
      at: payment.at,
      payment,
    })),
  ];

  return entries.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export function debtFromApi(debt: ApiSchema<"EmployeeDebt">): Debt {
  return {
    id: String(debt.id),
    amount: fromDecimal(debt.amount),
    at: debt.debt_date ?? debt.created_at,
    description: debt.description,
    paidBySalary: debt.paid_by_salary,
    byName: debt.created_by_name,
  };
}

export function debtToApi(values: DebtValues, at: IsoTimestamp) {
  return {
    amount: toMoneyDecimal(values.amount),
    debt_date: at,
    description: values.description,
    paid_by_salary: values.paidBySalary,
  };
}

export function debtErrorsFromApi(errors: BackendFieldErrors): FieldErrors<keyof DebtValues> {
  return {
    ...(errors.amount === undefined ? {} : { amount: errors.amount }),
    ...(errors.debt_date === undefined ? {} : { date: errors.debt_date }),
    ...(errors.description === undefined ? {} : { description: errors.description }),
    ...(errors.paid_by_salary === undefined ? {} : { paidBySalary: errors.paid_by_salary }),
  };
}

export function debtPaymentFromApi(payment: ApiSchema<"EmployeeDebtPayment">): DebtPayment {
  return {
    id: String(payment.id),
    amount: fromDecimal(payment.amount),
    at: payment.paid_at ?? payment.created_at,
    method: payment.method,
    note: payment.notes ?? "",
    byName: payment.created_by_name,
  };
}

export function debtPaymentToApi(values: WithdrawalValues, at: IsoTimestamp) {
  return {
    amount: toMoneyDecimal(values.amount),
    paid_at: at,
    notes: values.note,
  };
}

export function debtPaymentErrorsFromApi(
  errors: BackendFieldErrors,
): FieldErrors<keyof WithdrawalValues> {
  return {
    ...(errors.amount === undefined ? {} : { amount: errors.amount }),
    ...(errors.paid_at === undefined ? {} : { date: errors.paid_at }),
    ...(errors.notes === undefined ? {} : { note: errors.notes }),
  };
}
