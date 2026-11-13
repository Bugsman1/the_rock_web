import { z } from "zod";
import type { ApiSchema, BackendFieldErrors, FieldErrors } from "@/lib/api/client";
import { fromDecimal, toDecimal, toMoneyDecimal } from "@/lib/format";
import type { IsoTimestamp } from "@/lib/format";
import type { ProjectId } from "@/lib/projects";
import { isResourceKind, kindNamed, resourceKinds } from "@/lib/resourceKinds";
import type { ResourceKind } from "@/lib/resourceKinds";

const NOTE_MAX_LENGTH = 500;
const QUANTITY_PRECISION = 1000;

export type Resource = {
  id: string;
  project: ProjectId;
  projectName: string;
  kind: ResourceKind;
  initialQuantity: number;
  currentQuantity: number;
  isRefiningMaterial: boolean;
  isStockable: boolean;
  supplier: string | undefined;
  supplierName: string;
};

export type SupplierChoice = {
  id: string;
  name: string;
};

export function availableKinds(resources: readonly Resource[]): readonly ResourceKind[] {
  return resourceKinds.filter((kind) => !resources.some((resource) => resource.kind === kind));
}

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
      kind: z.string().refine((value): boolean => isResourceKind(value), messages.required),
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

export function createResourceSupplierSchema() {
  return z.object({ supplier: z.string() });
}

export type ResourceSupplierValues = z.infer<ReturnType<typeof createResourceSupplierSchema>>;

export type ResourceValues = z.infer<ReturnType<typeof createResourceSchema>>;

export function createResourceChangeSchema(
  messages: { required: string; quantityInvalid: string; quantityTooMuch: string },
  available?: number,
) {
  return z
    .object({
      quantity: z.number({ error: messages.required }).positive(messages.quantityInvalid),
      note: z.string().trim().max(NOTE_MAX_LENGTH),
    })
    .superRefine((values, context) => {
      if (available !== undefined && values.quantity > available) {
        context.addIssue({ code: "custom", path: ["quantity"], message: messages.quantityTooMuch });
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

function supplierOf(resource: ApiSchema<"Resource">) {
  return resource.supplier === null || resource.supplier === undefined
    ? { supplier: undefined, supplierName: "" }
    : { supplier: String(resource.supplier), supplierName: resource.supplier_name };
}

export function resourceFromApi(resource: ApiSchema<"Resource">): Resource | undefined {
  const isRefiningMaterial = resource.is_refining_material ?? false;
  const kind = isRefiningMaterial ? "mercury" : kindNamed(resource.name);

  return kind === undefined
    ? undefined
    : {
        id: String(resource.id),
        project: String(resource.project),
        projectName: resource.project_name,
        kind,
        initialQuantity: fromDecimal(resource.initial_quantity ?? "0"),
        currentQuantity: fromDecimal(resource.current_quantity),
        isRefiningMaterial,
        isStockable: resource.is_stockable,
        ...supplierOf(resource),
      };
}

export function resourceToApi(values: ResourceValues) {
  return {
    project: Number(values.project),
    name: values.kind,
    initial_quantity: toDecimal(values.initialQuantity),
    is_refining_material: values.kind === "mercury",
    is_stockable: true,
    ...supplierToApi(values),
    ...(chargesInitialPrice(values) ? { initial_price: toMoneyDecimal(values.initialPrice) } : {}),
  };
}

export function supplierToApi(values: ResourceSupplierValues) {
  return { supplier: values.supplier === "" ? null : Number(values.supplier) };
}

export function supplierChoiceFromApi(supplier: ApiSchema<"Supplier">): SupplierChoice {
  return { id: String(supplier.id), name: supplier.name };
}

export function resourceErrorsFromApi(
  errors: BackendFieldErrors,
): FieldErrors<keyof ResourceValues> {
  return {
    ...(errors.project === undefined ? {} : { project: errors.project }),
    ...(errors.initial_quantity === undefined ? {} : { initialQuantity: errors.initial_quantity }),
    ...(errors.name === undefined ? {} : { kind: errors.name }),
    ...(errors.is_refining_material === undefined ? {} : { kind: errors.is_refining_material }),
    ...(errors.supplier === undefined ? {} : { supplier: errors.supplier }),
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

export function resourceChangeErrorsFromApi(
  errors: BackendFieldErrors,
): FieldErrors<keyof ResourceChangeValues> {
  return {
    ...(errors.quantity === undefined ? {} : { quantity: errors.quantity }),
    ...(errors.note === undefined ? {} : { note: errors.note }),
  };
}
