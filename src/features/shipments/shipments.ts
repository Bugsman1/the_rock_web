import { z } from "zod";
import type { BackendFieldErrors, FieldErrors } from "@/lib/api/client";
import { isIsoDate, isTimeValue } from "@/lib/datetime";
import { toOldOuguiya } from "@/lib/format";
import type { IsoTimestamp } from "@/lib/format";
import { isValidPhone } from "@/lib/phone";
import type { ProjectId } from "@/lib/projects";
import { matchesSearch } from "@/lib/search";
import { shipmentStatusKeys } from "@/lib/shipments";
import type { ShipmentRecord, ShipmentStatusKey } from "@/lib/shipments";

export const transportMethodKeys = ["truck", "hilux", "other"] as const;

type ClientBags = {
  name: string;
  bagCount: number;
};

const storedStatuses: readonly ShipmentStatusKey[] = ["pending"];

const TOP_CLIENTS_LIMIT = 6;

export function isInStorage(record: ShipmentRecord): boolean {
  return storedStatuses.includes(record.status);
}

export function storedShipments(
  records: readonly ShipmentRecord[],
  project?: ProjectId,
): readonly ShipmentRecord[] {
  return records.filter(
    (record) => isInStorage(record) && (project === undefined || record.project === project),
  );
}

export function shipmentsOfProject(
  records: readonly ShipmentRecord[],
  project: ProjectId,
): readonly ShipmentRecord[] {
  return records.filter((record) => record.project === project);
}

export function bagCount(records: readonly ShipmentRecord[]): number {
  return records.reduce((total, record) => total + record.bagCount, 0);
}

export function clientBags(records: readonly ShipmentRecord[]): readonly ClientBags[] {
  const totals = new Map<string, number>();

  for (const record of records) {
    totals.set(record.customerName, (totals.get(record.customerName) ?? 0) + record.bagCount);
  }

  return [...totals].map(([name, bags]) => ({ name, bagCount: bags }));
}

export function topClientsByBags(
  clients: readonly ClientBags[],
  limit: number = TOP_CLIENTS_LIMIT,
): readonly ClientBags[] {
  return [...clients].sort((a, b) => b.bagCount - a.bagCount).slice(0, limit);
}

export function shipmentsByArrival(records: readonly ShipmentRecord[]): readonly ShipmentRecord[] {
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

const NOTES_MAX_LENGTH = 1000;

type ValidationMessages = {
  required: string;
  bagCountInvalid: string;
  phoneInvalid: string;
  dateInvalid: string;
  timeInvalid: string;
  amountInvalid: string;
  passengerCountInvalid: string;
};

export function createNewShipmentSchema(messages: ValidationMessages) {
  return z.object({
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
      .int(messages.bagCountInvalid)
      .min(1, messages.bagCountInvalid),
    transportMethod: z.enum(transportMethodKeys),
    source: z.string().trim().min(1, messages.required),
    bagFare: z.number({ error: messages.amountInvalid }).min(0, messages.amountInvalid),
    passengerCount: z
      .number({ error: messages.passengerCountInvalid })
      .int(messages.passengerCountInvalid)
      .min(0, messages.passengerCountInvalid),
    passengerFare: z.number({ error: messages.amountInvalid }).min(0, messages.amountInvalid),
    mill: z.string().min(1, messages.required),
    status: z.enum(shipmentStatusKeys),
    notes: z.string().max(NOTES_MAX_LENGTH),
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
  "mill",
  "status",
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
  project: "mill",
  status: "status",
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
    bag_transport_cost_per_bag: String(toOldOuguiya(values.bagFare)),
    passengers_count: values.passengerCount,
    passenger_transport_cost_per_person: String(toOldOuguiya(values.passengerFare)),
    transport_method: values.transportMethod,
    source: values.source.trim(),
    project: Number(values.mill),
    status: values.status,
    notes: values.notes.trim(),
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
