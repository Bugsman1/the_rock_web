import { z } from "zod";
import type { ApiSchema, BackendFieldErrors, FieldErrors } from "@/lib/api/client";
import { isIsoDate, isTimeValue, nowAsTimeValue, todayAsInputValue } from "@/lib/datetime";
import { fromDecimal, toMoneyDecimal } from "@/lib/format";
import type { IsoTimestamp } from "@/lib/format";
import { isHalfBagCount, remainingBags } from "@/lib/grinding";
import type { MillingOperation } from "@/lib/grinding";
import { isValidPhone } from "@/lib/phone";
import type { ProjectId } from "@/lib/projects";
import { matchesSearch } from "@/lib/search";
import { shipmentFromApi } from "@/lib/shipments";
import type { ShipmentRecord, ShipmentStatusKey } from "@/lib/shipments";

export const transportMethodKeys = ["truck", "hilux", "other"] as const;

type ClientBags = {
  name: string;
  bagCount: number;
};

const storedStatuses: readonly ShipmentStatusKey[] = ["pending", "grinding"];

export type StoredShipment = ShipmentRecord & { remainingBags: number };

const TOP_CLIENTS_LIMIT = 6;

export function isInStorage(record: ShipmentRecord): boolean {
  return storedStatuses.includes(record.status);
}

export function openShipments(
  records: readonly ShipmentRecord[],
  operations: readonly MillingOperation[],
  project?: ProjectId,
): readonly StoredShipment[] {
  return records
    .filter(
      (record) => isInStorage(record) && (project === undefined || record.project === project),
    )
    .map((record) => ({
      ...record,
      remainingBags: remainingBags(
        { shipmentNumber: record.shipmentNumber, bags: record.bagCount },
        operations,
      ),
    }));
}

export function storedShipments(
  records: readonly ShipmentRecord[],
  operations: readonly MillingOperation[],
  project?: ProjectId,
): readonly StoredShipment[] {
  return openShipments(records, operations, project).filter((record) => record.remainingBags > 0);
}

export function shipmentsOfProject<Shipment extends ShipmentRecord>(
  records: readonly Shipment[],
  project: ProjectId,
): readonly Shipment[] {
  return records.filter((record) => record.project === project);
}

export function bagCount(records: readonly StoredShipment[]): number {
  return records.reduce((total, record) => total + record.remainingBags, 0);
}

export function clientBags(records: readonly StoredShipment[]): readonly ClientBags[] {
  const totals = new Map<string, number>();

  for (const record of records) {
    totals.set(record.customerName, (totals.get(record.customerName) ?? 0) + record.remainingBags);
  }

  return [...totals].map(([name, bags]) => ({ name, bagCount: bags }));
}

export function topClientsByBags(
  clients: readonly ClientBags[],
  limit: number = TOP_CLIENTS_LIMIT,
): readonly ClientBags[] {
  return [...clients].sort((a, b) => b.bagCount - a.bagCount).slice(0, limit);
}

export function shipmentsByArrival<Shipment extends ShipmentRecord>(
  records: readonly Shipment[],
): readonly Shipment[] {
  return [...records].sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt));
}

export function bagShare(bags: number, largestBagCount: number): number {
  if (largestBagCount <= 0) return 0;

  return Math.min(100, Math.round((bags / largestBagCount) * 100));
}

export type HistoryFilter = {
  from: string;
  to: string;
  query: string;
};

export const emptyHistoryFilter: HistoryFilter = { from: "", to: "", query: "" };

export function isFilterActive(filter: HistoryFilter): boolean {
  return filter.from !== "" || filter.to !== "" || filter.query.trim() !== "";
}

function arrivalDay(record: ShipmentRecord): string {
  return record.arrivedAt.slice(0, 10);
}

export function matchesQuery(record: ShipmentRecord, query: string): boolean {
  return matchesSearch(
    { texts: [record.customerName, record.shipmentNumber], phone: record.phone },
    query,
  );
}

export function filterShipments(
  records: readonly ShipmentRecord[],
  filter: HistoryFilter,
): readonly ShipmentRecord[] {
  const from = isIsoDate(filter.from) ? filter.from : undefined;
  const to = isIsoDate(filter.to) ? filter.to : undefined;

  return records
    .filter((record) => from === undefined || arrivalDay(record) >= from)
    .filter((record) => to === undefined || arrivalDay(record) <= to)
    .filter((record) => matchesQuery(record, filter.query))
    .sort((a, b) => b.arrivedAt.localeCompare(a.arrivedAt));
}

type TransportCostInput = {
  bagCount: number;
  bagFare: number;
  passengerCount: number;
  passengerFare: number;
};

function amountOrZero(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function bagsCost(bagCount: number, bagFare: number): number {
  return amountOrZero(bagCount) * amountOrZero(bagFare);
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

const MONEY_CENTS = 100;

export function amountLeftAfter(amountLeft: number, payment: number): number | undefined {
  return Number.isFinite(payment) && payment > 0 && payment <= amountLeft
    ? Math.round((amountLeft - payment) * MONEY_CENTS) / MONEY_CENTS
    : undefined;
}

export function completedShipments(records: readonly ShipmentRecord[]): readonly ShipmentRecord[] {
  return records.filter((record) => record.status === "completed");
}

const NOTES_MAX_LENGTH = 1000;

type ValidationMessages = {
  required: string;
  bagCountInvalid: string;
  phoneInvalid: string;
  dateInvalid: string;
  timeInvalid: string;
  amountInvalid: string;
  passengerCountInvalid: string;
  paymentTooHigh: string;
  totalBelowPaid: string;
};

export function createNewShipmentSchema(messages: ValidationMessages, alreadyPaid = 0) {
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
    .superRefine((values, context) => {
      if (amountOrZero(values.currentPayment) > transportTotal(values)) {
        context.addIssue({
          code: "custom",
          path: ["currentPayment"],
          message: messages.paymentTooHigh,
        });
      }

      if (alreadyPaid > transportTotal(values)) {
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
  current_payment: "currentPayment",
  debt: "debt",
  debt_notes: "debtNotes",
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
    transport_method: values.transportMethod,
    source: values.source.trim(),
    project: Number(values.mill),
    debt: toMoneyDecimal(amountOrZero(values.debt)),
    debt_notes: values.debtNotes.trim(),
    notes: values.notes.trim(),
  };
}

export function newShipmentToApi(values: NewShipmentValues, target: ShipmentTarget) {
  return {
    ...shipmentToApi(values, target),
    current_payment: toMoneyDecimal(amountOrZero(values.currentPayment)),
  };
}

export type ShipmentPayment = {
  id: string;
  amount: number;
  paidAt: IsoTimestamp;
  notes: string;
};

export type ShipmentDetail = ShipmentRecord & {
  transportMethod: (typeof transportMethodKeys)[number];
  bagFare: number;
  passengerCount: number;
  passengerFare: number;
  debtNotes: string;
  payments: readonly ShipmentPayment[];
};

export function shipmentDetailFromApi(shipment: ApiSchema<"Shipment">): ShipmentDetail {
  return {
    ...shipmentFromApi(shipment),
    transportMethod: shipment.transport_method,
    bagFare: fromDecimal(shipment.bag_transport_cost_per_bag),
    passengerCount: shipment.passengers_count ?? 0,
    passengerFare: fromDecimal(shipment.passenger_transport_cost_per_person ?? "0"),
    debtNotes: shipment.debt_notes ?? "",
    payments: (shipment.payments ?? []).map((payment) => ({
      id: String(payment.id),
      amount: fromDecimal(payment.amount),
      paidAt: payment.paid_at,
      notes: payment.notes,
    })),
  };
}

export function shipmentFormValues(shipment: ShipmentDetail): NewShipmentValues {
  const arrivedAt = new Date(shipment.arrivedAt);

  return {
    customerName: shipment.customerName,
    phone: shipment.phone,
    arrivalDate: todayAsInputValue(arrivedAt),
    arrivalTime: nowAsTimeValue(arrivedAt),
    bagCount: shipment.bagCount,
    transportMethod: shipment.transportMethod,
    source: shipment.source,
    bagFare: shipment.bagFare,
    passengerCount: shipment.passengerCount,
    passengerFare: shipment.passengerFare,
    currentPayment: Number.NaN,
    debt: shipment.debt,
    debtNotes: shipment.debtNotes,
    mill: shipment.project,
    notes: shipment.notes,
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

const ATTACHMENT_FILE_NAME = /filename="([^"]+)"/;

export function invoiceFileName(contentDisposition: string | null): string | undefined {
  return contentDisposition?.match(ATTACHMENT_FILE_NAME)?.[1];
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
