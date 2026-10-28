import { z } from "zod";
import type { BackendFieldErrors, FieldErrors } from "@/lib/api/client";
import { isIsoDate, isTimeValue } from "@/lib/datetime";
import { amountOrZero, toMoneyDecimal } from "@/lib/format";
import type { IsoTimestamp } from "@/lib/format";
import { isHalfBagCount } from "@/lib/grinding";
import { isValidPhone } from "@/lib/phone";

export const transportMethodKeys = ["truck", "hilux", "other"] as const;

type TransportCostInput = {
  bagCount: number;
  bagFare: number;
  passengerCount: number;
  passengerFare: number;
};

export function transportedBags(bagCount: number, testBags: number): number {
  return amountOrZero(bagCount) + testBags;
}

export function bagsCost(bagCount: number, bagFare: number): number {
  return amountOrZero(bagCount) * amountOrZero(bagFare);
}

export function hasPassengers(passengerCount: number): boolean {
  return amountOrZero(passengerCount) > 0;
}

export function passengersCost(passengerCount: number, passengerFare: number): number {
  return amountOrZero(passengerCount) * amountOrZero(passengerFare);
}

export function transportTotal({
  bagCount,
  bagFare,
  passengerCount,
  passengerFare,
}: TransportCostInput): number {
  return bagsCost(bagCount, bagFare) + passengersCost(passengerCount, passengerFare);
}

export function remainingToPay(total: number, payment: number): number {
  return Math.max(0, total - amountOrZero(payment));
}

export const NOTES_MAX_LENGTH = 1000;

type ValidationMessages = {
  required: string;
  bagCountInvalid: string;
  phoneInvalid: string;
  dateInvalid: string;
  timeInvalid: string;
  amountInvalid: string;
  passengerCountInvalid: string;
  passengerFareRequired: string;
  paymentTooHigh: string;
  totalBelowPaid: string;
};

export function createNewShipmentSchema(
  messages: ValidationMessages,
  alreadyPaid = 0,
  testBags = 0,
) {
  return z
    .object({
      customerName: z.string().trim().min(1, messages.required),
      phone: z
        .string()
        .trim()
        .min(1, { message: messages.required, abort: true })
        .refine(isValidPhone, messages.phoneInvalid),
      arrivalDate: z
        .string()
        .min(1, { message: messages.required, abort: true })
        .refine(isIsoDate, messages.dateInvalid),
      arrivalTime: z
        .string()
        .min(1, { message: messages.required, abort: true })
        .refine(isTimeValue, messages.timeInvalid),
      bagCount: z
        .number({ error: messages.bagCountInvalid })
        .refine(isHalfBagCount, messages.bagCountInvalid),
      transportMethod: z.enum(transportMethodKeys),
      source: z.string().trim().min(1, messages.required),
      bagFare: z.number({ error: messages.amountInvalid }).min(0, messages.amountInvalid),
      passengerCount: z.union(
        [
          z.nan(),
          z.number().int(messages.passengerCountInvalid).min(0, messages.passengerCountInvalid),
        ],
        { error: messages.passengerCountInvalid },
      ),
      passengerFare: z.union([z.nan(), z.number().min(0, messages.amountInvalid)], {
        error: messages.amountInvalid,
      }),
      unloadingFare: z.union([z.nan(), z.number().min(0, messages.amountInvalid)], {
        error: messages.amountInvalid,
      }),
      currentPayment: z.union([z.nan(), z.number().min(0, messages.amountInvalid)], {
        error: messages.amountInvalid,
      }),
      debt: z.union([z.nan(), z.number().min(0, messages.amountInvalid)], {
        error: messages.amountInvalid,
      }),
      debtNotes: z.string().max(NOTES_MAX_LENGTH),
      mill: z.string().min(1, messages.required),
      notes: z.string().max(NOTES_MAX_LENGTH),
    })
    .refine(
      (values) => !hasPassengers(values.passengerCount) || amountOrZero(values.passengerFare) > 0,
      { path: ["passengerFare"], message: messages.passengerFareRequired, when: () => true },
    )
    .superRefine((values, context) => {
      const total = transportTotal({
        ...values,
        bagCount: transportedBags(values.bagCount, testBags),
      });

      if (amountOrZero(values.currentPayment) > total) {
        context.addIssue({
          code: "custom",
          path: ["currentPayment"],
          message: messages.paymentTooHigh,
        });
      }

      if (alreadyPaid > total) {
        context.addIssue({ code: "custom", path: ["bagFare"], message: messages.totalBelowPaid });
      }
    });
}

export type NewShipmentValues = z.infer<ReturnType<typeof createNewShipmentSchema>>;

type ShipmentField = keyof NewShipmentValues;

const shipmentFields: readonly ShipmentField[] = [
  "customerName",
  "phone",
  "arrivalDate",
  "arrivalTime",
  "bagCount",
  "transportMethod",
  "source",
  "bagFare",
  "passengerCount",
  "passengerFare",
  "unloadingFare",
  "currentPayment",
  "debt",
  "debtNotes",
  "mill",
  "notes",
];

const fieldOfApi: Readonly<Record<string, ShipmentField>> = {
  customer: "customerName",
  arrival_date: "arrivalDate",
  bags_count: "bagCount",
  transport_method: "transportMethod",
  source: "source",
  bag_transport_cost_per_bag: "bagFare",
  passengers_count: "passengerCount",
  passenger_transport_cost_per_person: "passengerFare",
  unloading_cost_per_bag: "unloadingFare",
  current_payment: "currentPayment",
  project: "mill",
  notes: "notes",
};

export function isShipmentField(value: string): value is ShipmentField {
  return shipmentFields.some((field) => field === value);
}

type ShipmentTarget = {
  customerId: string;
  arrivedAt: IsoTimestamp;
};

export function shipmentToApi(
  values: NewShipmentValues,
  { customerId, arrivedAt }: ShipmentTarget,
) {
  return {
    customer: Number(customerId),
    arrival_date: arrivedAt,
    bags_count: values.bagCount,
    bag_transport_cost_per_bag: toMoneyDecimal(values.bagFare),
    passengers_count: amountOrZero(values.passengerCount),
    passenger_transport_cost_per_person: toMoneyDecimal(amountOrZero(values.passengerFare)),
    unloading_cost_per_bag: Number.isNaN(values.unloadingFare)
      ? null
      : toMoneyDecimal(values.unloadingFare),
    transport_method: values.transportMethod,
    source: values.source.trim(),
    project: Number(values.mill),
    notes: values.notes.trim(),
  };
}

export function newShipmentToApi(values: NewShipmentValues, target: ShipmentTarget) {
  return {
    ...shipmentToApi(values, target),
    current_payment: toMoneyDecimal(amountOrZero(values.currentPayment)),
  };
}

export function shipmentErrorsFromApi(errors: BackendFieldErrors): FieldErrors<ShipmentField> {
  const fieldErrors: FieldErrors<ShipmentField> = {};

  for (const [apiField, message] of Object.entries(errors)) {
    const field = fieldOfApi[apiField];

    if (field !== undefined && fieldErrors[field] === undefined) {
      fieldErrors[field] = message;
    }
  }

  return fieldErrors;
}
