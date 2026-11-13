import { z } from "zod";
import type { ApiSchema, BackendFieldErrors, FieldErrors } from "@/lib/api/client";
import { requiredIsoDate, requiredTime } from "@/lib/datetime";
import { fromDecimal, toDecimal, toMoneyDecimal } from "@/lib/format";
import type { IsoTimestamp } from "@/lib/format";
import { kindNamed } from "@/lib/resourceKinds";
import type { SuppliedResource } from "./suppliers";

const NOTE_MAX_LENGTH = 500;

export type AccountEntry = {
  key: string;
  type: ApiSchema<"SupplierHistoryEntryTypeEnum">;
  id: string;
  at: IsoTimestamp;
  amount: number;
  resource: Pick<SuppliedResource, "kind" | "name"> | undefined;
  quantity: number | undefined;
  isInitial: boolean;
  note: string;
  byName: string | null;
  balance: number;
};

export type SupplierPayment = {
  id: string;
  amount: number;
  at: IsoTimestamp;
  note: string;
};

export type SupplierDelivery = {
  id: string;
  resource: SuppliedResource;
  quantity: number;
  price: number;
  at: IsoTimestamp;
  note: string;
  isInitial: boolean;
};

type DateTimeMessages = { required: string; dateInvalid: string; timeInvalid: string };

export function createPaymentSchema(messages: DateTimeMessages & { amountInvalid: string }) {
  return z.object({
    amount: z.number({ error: messages.amountInvalid }).positive(messages.amountInvalid),
    date: requiredIsoDate(messages),
    time: requiredTime(messages),
    note: z.string().trim().max(NOTE_MAX_LENGTH),
  });
}

export type PaymentValues = z.infer<ReturnType<typeof createPaymentSchema>>;

export function createDeliverySchema(
  messages: DateTimeMessages & { quantityInvalid: string; priceInvalid: string },
) {
  return z.object({
    resource: z.string().min(1, messages.required),
    quantity: z.number({ error: messages.quantityInvalid }).positive(messages.quantityInvalid),
    price: z.number({ error: messages.priceInvalid }).min(0, messages.priceInvalid),
    date: requiredIsoDate(messages),
    time: requiredTime(messages),
    note: z.string().trim().max(NOTE_MAX_LENGTH),
  });
}

export type DeliveryValues = z.infer<ReturnType<typeof createDeliverySchema>>;

const paymentFields: readonly (keyof PaymentValues)[] = ["amount", "date", "time", "note"];

export function isPaymentField(value: string): value is keyof PaymentValues {
  return paymentFields.some((field) => field === value);
}

const deliveryFields: readonly (keyof DeliveryValues)[] = [
  "resource",
  "quantity",
  "price",
  "date",
  "time",
  "note",
];

export function isDeliveryField(value: string): value is keyof DeliveryValues {
  return deliveryFields.some((field) => field === value);
}

export function accountEntryFromApi(entry: ApiSchema<"SupplierHistoryEntry">): AccountEntry {
  return {
    key: `${entry.type}-${String(entry.id)}`,
    type: entry.type,
    id: String(entry.id),
    at: entry.date,
    amount: fromDecimal(entry.amount),
    resource:
      entry.resource_name === null
        ? undefined
        : { kind: kindNamed(entry.resource_name), name: entry.resource_name },
    quantity: entry.quantity === null ? undefined : fromDecimal(entry.quantity),
    isInitial: entry.is_initial,
    note: entry.notes,
    byName: entry.created_by_name,
    balance: fromDecimal(entry.balance),
  };
}

export function paymentFromApi(payment: ApiSchema<"SupplierPayment">): SupplierPayment {
  return {
    id: String(payment.id),
    amount: fromDecimal(payment.amount),
    at: payment.paid_at ?? payment.created_at,
    note: payment.notes ?? "",
  };
}

export function deliveryFromApi(delivery: ApiSchema<"SupplierDelivery">): SupplierDelivery {
  return {
    id: String(delivery.id),
    resource: {
      id: String(delivery.resource),
      kind: kindNamed(delivery.resource_name),
      name: delivery.resource_name,
      projectName: delivery.project_name,
    },
    quantity: fromDecimal(delivery.quantity),
    price: fromDecimal(delivery.price),
    at: delivery.delivered_at ?? delivery.created_at,
    note: delivery.notes ?? "",
    isInitial: delivery.is_initial,
  };
}

export function paymentToApi(values: PaymentValues, at: IsoTimestamp) {
  return {
    amount: toMoneyDecimal(values.amount),
    paid_at: at,
    notes: values.note,
  };
}

export function deliveryChangesToApi(values: DeliveryValues, at: IsoTimestamp, isInitial: boolean) {
  return {
    ...(isInitial ? {} : { quantity: toDecimal(values.quantity) }),
    price: toMoneyDecimal(values.price),
    delivered_at: at,
    notes: values.note,
  };
}

export function newDeliveryToApi(values: DeliveryValues, at: IsoTimestamp) {
  return {
    ...deliveryChangesToApi(values, at, false),
    resource: Number(values.resource),
    quantity: toDecimal(values.quantity),
  };
}

export function paymentErrorsFromApi(errors: BackendFieldErrors): FieldErrors<keyof PaymentValues> {
  return {
    ...(errors.amount === undefined ? {} : { amount: errors.amount }),
    ...(errors.paid_at === undefined ? {} : { date: errors.paid_at }),
    ...(errors.notes === undefined ? {} : { note: errors.notes }),
  };
}

export function deliveryErrorsFromApi(
  errors: BackendFieldErrors,
): FieldErrors<keyof DeliveryValues> {
  return {
    ...(errors.resource === undefined ? {} : { resource: errors.resource }),
    ...(errors.quantity === undefined ? {} : { quantity: errors.quantity }),
    ...(errors.price === undefined ? {} : { price: errors.price }),
    ...(errors.delivered_at === undefined ? {} : { date: errors.delivered_at }),
    ...(errors.notes === undefined ? {} : { note: errors.notes }),
  };
}
