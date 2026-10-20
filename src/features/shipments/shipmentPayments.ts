import { z } from "zod";
import type { BackendFieldErrors, FieldErrors } from "@/lib/api/client";
import { isIsoDate, isTimeValue } from "@/lib/datetime";
import { amountOrZero, roundMoney, toMoneyDecimal } from "@/lib/format";
import type { IsoTimestamp } from "@/lib/format";
import { NOTES_MAX_LENGTH } from "./shipments";

export function amountLeftAfter(amountLeft: number, payment: number): number | undefined {
  return Number.isFinite(payment) && payment > 0 && payment <= amountLeft
    ? roundMoney(amountLeft - payment)
    : undefined;
}

export function createDebtSchema(messages: { amountInvalid: string }) {
  return z.object({
    amount: z.number({ error: messages.amountInvalid }).positive(messages.amountInvalid),
    notes: z.string().max(NOTES_MAX_LENGTH),
  });
}

export type DebtValues = z.infer<ReturnType<typeof createDebtSchema>>;

export function debtAfter(debt: number, added: number): number {
  return roundMoney(debt + amountOrZero(added));
}

export function debtToApi(debt: number, values: DebtValues) {
  return {
    debt: toMoneyDecimal(debtAfter(debt, values.amount)),
    debt_notes: values.notes.trim(),
  };
}

export function debtErrorsFromApi(errors: BackendFieldErrors): FieldErrors<keyof DebtValues> {
  return {
    ...(errors.debt === undefined ? {} : { amount: errors.debt }),
    ...(errors.debt_notes === undefined ? {} : { notes: errors.debt_notes }),
  };
}

export function createPaymentSchema(
  messages: {
    required: string;
    dateInvalid: string;
    timeInvalid: string;
    amountInvalid: string;
    amountTooHigh: string;
  },
  amountLeft: number,
) {
  return z.object({
    amount: z
      .number({ error: messages.amountInvalid })
      .positive(messages.amountInvalid)
      .max(amountLeft, messages.amountTooHigh),
    date: z
      .string()
      .min(1, { message: messages.required, abort: true })
      .refine(isIsoDate, messages.dateInvalid),
    time: z
      .string()
      .min(1, { message: messages.required, abort: true })
      .refine(isTimeValue, messages.timeInvalid),
    notes: z.string().trim().max(NOTES_MAX_LENGTH),
  });
}

export type PaymentValues = z.infer<ReturnType<typeof createPaymentSchema>>;

export function paymentToApi(values: PaymentValues, shipmentId: string, paidAt: IsoTimestamp) {
  return {
    shipment: Number(shipmentId),
    amount: toMoneyDecimal(values.amount),
    paid_at: paidAt,
    notes: values.notes,
  };
}

export function paymentErrorsFromApi(errors: BackendFieldErrors): FieldErrors<keyof PaymentValues> {
  const amount = errors.amount ?? errors.shipment;

  return {
    ...(amount === undefined ? {} : { amount }),
    ...(errors.paid_at === undefined ? {} : { date: errors.paid_at }),
    ...(errors.notes === undefined ? {} : { notes: errors.notes }),
  };
}
