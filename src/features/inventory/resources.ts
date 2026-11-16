import { z } from "zod";
import type { ApiSchema, BackendFieldErrors, FieldErrors } from "@/lib/api/client";
import { fromDecimal, toDecimal, toMoneyDecimal } from "@/lib/format";
import type { IsoTimestamp } from "@/lib/format";
import type { ProjectId } from "@/lib/projects";
import { kindNamed } from "@/lib/resourceKinds";
import type { ResourceKind } from "@/lib/resourceKinds";
import type { SupplierChoice } from "@/lib/suppliersApi";

const NAME_MAX_LENGTH = 150;
const NOTE_MAX_LENGTH = 500;
const QUANTITY_PRECISION = 1000;

export type Resource = {
  id: string;
  project: ProjectId;
  projectName: string;
  kind: ResourceKind | undefined;
  name: string;
  initialQuantity: number;
  currentQuantity: number;
  isRefiningMaterial: boolean;
  isStockable: boolean;
  suppliers: readonly SupplierChoice[];
};

export const resourceChangeTypes = ["increase", "decrease"] as const;

export type ResourceChangeType = (typeof resourceChangeTypes)[number];

export type ResourceChange = {
  id: string;
  type: ApiSchema<"ChangeTypeEnum">;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  fromRefining: boolean;
  shipmentNumber: string | undefined;
  grindingSequence: number | undefined;
  loss: number | undefined;
  supplierName: string;
  note: string;
  byName: string;
  at: IsoTimestamp;
};

export function chargesInitialPrice(values: { supplier: string; initialQuantity: number }) {
  return values.supplier !== "" && values.initialQuantity > 0;
}

export function createResourceSchema(messages: {
  required: string;
  quantityInvalid: string;
  priceInvalid: string;
}) {
  return z
    .object({
      project: z.string().min(1, messages.required),
      name: z.string().trim().min(1, messages.required).max(NAME_MAX_LENGTH),
      initialQuantity: z.number({ error: messages.required }).min(0, messages.quantityInvalid),
      supplier: z.string(),
      initialPrice: z.union([z.nan(), z.number()]),
    })
    .superRefine((values, context) => {
      if (chargesInitialPrice(values) && !(values.initialPrice >= 0)) {
        context.addIssue({
          code: "custom",
          path: ["initialPrice"],
          message: messages.priceInvalid,
        });
      }
    });
}

export type ResourceValues = z.infer<ReturnType<typeof createResourceSchema>>;

export function createResourceChangeSchema(
  messages: {
    required: string;
    quantityInvalid: string;
    quantityTooMuch: string;
    priceInvalid: string;
  },
  available?: number,
) {
  return z
    .object({
      quantity: z.number({ error: messages.required }).positive(messages.quantityInvalid),
      note: z.string().trim().max(NOTE_MAX_LENGTH),
      fromSupplier: z.boolean(),
      supplier: z.string(),
      price: z.union([z.nan(), z.number()]),
    })
    .superRefine((values, context) => {
      if (available !== undefined && values.quantity > available) {
        context.addIssue({ code: "custom", path: ["quantity"], message: messages.quantityTooMuch });
      }

      if (values.fromSupplier && values.supplier === "") {
        context.addIssue({ code: "custom", path: ["supplier"], message: messages.required });
      }

      if (values.fromSupplier && !(values.price >= 0)) {
        context.addIssue({ code: "custom", path: ["price"], message: messages.priceInvalid });
      }
    });
}

export type ResourceChangeValues = z.infer<ReturnType<typeof createResourceChangeSchema>>;

export function quantityAfterChange(
  current: number,
  type: ResourceChangeType,
  quantity: number,
): number | undefined {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return undefined;
  }

  const after = type === "increase" ? current + quantity : current - quantity;

  return Math.round(after * QUANTITY_PRECISION) / QUANTITY_PRECISION;
}

function supplierChoicesOf(entry: Record<string, unknown>): SupplierChoice[] {
  const { id, name } = entry;

  return typeof id === "number" && typeof name === "string" ? [{ id: String(id), name }] : [];
}

export function resourceFromApi(resource: ApiSchema<"Resource">): Resource {
  const isRefiningMaterial = resource.is_refining_material ?? false;

  return {
    id: String(resource.id),
    project: String(resource.project),
    projectName: resource.project_name,
    kind: isRefiningMaterial ? "mercury" : kindNamed(resource.name),
    name: resource.name,
    initialQuantity: fromDecimal(resource.initial_quantity ?? "0"),
    currentQuantity: fromDecimal(resource.current_quantity),
    isRefiningMaterial,
    isStockable: resource.is_stockable,
    suppliers: resource.suppliers.flatMap(supplierChoicesOf),
  };
}

export function resourceToApi(values: ResourceValues) {
  return {
    project: Number(values.project),
    name: values.name,
    initial_quantity: toDecimal(values.initialQuantity),
    is_refining_material: kindNamed(values.name) === "mercury",
    is_stockable: true,
    ...(chargesInitialPrice(values)
      ? {
          initial_supplier: Number(values.supplier),
          initial_price: toMoneyDecimal(values.initialPrice),
        }
      : {}),
  };
}

export function resourceErrorsFromApi(
  errors: BackendFieldErrors,
): FieldErrors<keyof ResourceValues> {
  return {
    ...(errors.project === undefined ? {} : { project: errors.project }),
    ...(errors.initial_quantity === undefined ? {} : { initialQuantity: errors.initial_quantity }),
    ...(errors.name === undefined ? {} : { name: errors.name }),
    ...(errors.is_refining_material === undefined ? {} : { name: errors.is_refining_material }),
    ...(errors.initial_supplier === undefined ? {} : { supplier: errors.initial_supplier }),
    ...(errors.initial_price === undefined ? {} : { initialPrice: errors.initial_price }),
  };
}

export function resourceChangeFromApi(entry: ApiSchema<"ResourceHistory">): ResourceChange {
  return {
    id: String(entry.id),
    type: entry.change_type,
    quantity: fromDecimal(entry.quantity),
    quantityBefore: fromDecimal(entry.quantity_before),
    quantityAfter: fromDecimal(entry.quantity_after),
    fromRefining: entry.refining_operation !== null,
    shipmentNumber: entry.shipment_number ?? undefined,
    grindingSequence: entry.grinding_sequence ?? undefined,
    loss: entry.loss === null ? undefined : fromDecimal(entry.loss),
    supplierName: entry.supplier_delivery === null ? "" : entry.supplier_name,
    note: entry.note,
    byName: entry.created_by_name,
    at: entry.created_at,
  };
}

export function refiningCorrectionType(change: ResourceChange): ResourceChangeType | undefined {
  return change.fromRefining && (change.type === "increase" || change.type === "decrease")
    ? change.type
    : undefined;
}

export function resourceChangeToApi(values: ResourceChangeValues) {
  return {
    quantity: toDecimal(values.quantity),
    note: values.note,
  };
}

export function supplierIncreaseToApi(resourceId: string, values: ResourceChangeValues) {
  return {
    supplier: Number(values.supplier),
    resource: Number(resourceId),
    quantity: toDecimal(values.quantity),
    price: toMoneyDecimal(values.price),
    notes: values.note,
  };
}

export function supplierIncreaseErrorsFromApi(
  errors: BackendFieldErrors,
): FieldErrors<keyof ResourceChangeValues> {
  const supplier = errors.supplier ?? errors.resource;

  return {
    ...(errors.quantity === undefined ? {} : { quantity: errors.quantity }),
    ...(errors.price === undefined ? {} : { price: errors.price }),
    ...(supplier === undefined ? {} : { supplier }),
    ...(errors.notes === undefined ? {} : { note: errors.notes }),
  };
}

export function resourceChangeErrorsFromApi(
  errors: BackendFieldErrors,
): FieldErrors<keyof ResourceChangeValues> {
  return {
    ...(errors.quantity === undefined ? {} : { quantity: errors.quantity }),
    ...(errors.note === undefined ? {} : { note: errors.note }),
  };
}
