import { z } from "zod";
import type { ApiSchema, BackendFieldErrors, FieldErrors } from "@/lib/api/client";
import { fromDecimal, toDecimal } from "@/lib/format";
import type { IsoTimestamp } from "@/lib/format";
import type { ProjectId } from "@/lib/projects";

const NAME_MAX_LENGTH = 150;
const NOTE_MAX_LENGTH = 500;
const QUANTITY_PRECISION = 1000;

export type Resource = {
  id: string;
  project: ProjectId;
  projectName: string;
  name: string;
  initialQuantity: number;
  currentQuantity: number;
  isRefiningMaterial: boolean;
};

export const fixedResourceKinds = ["mercury", "water", "fuel"] as const;

export type FixedResourceKind = (typeof fixedResourceKinds)[number];

export const resourceKinds = [...fixedResourceKinds, "other"] as const;

export type ResourceKind = (typeof resourceKinds)[number];

function isFixedResourceKind(value: string): value is FixedResourceKind {
  return fixedResourceKinds.some((kind) => kind === value);
}

export function isResourceKind(value: string): value is ResourceKind {
  return resourceKinds.some((kind) => kind === value);
}

export function kindOf(resource: Pick<Resource, "name" | "isRefiningMaterial">): ResourceKind {
  if (resource.isRefiningMaterial) {
    return "mercury";
  }

  return isFixedResourceKind(resource.name) ? resource.name : "other";
}

export function availableKinds(resources: readonly Resource[]): readonly ResourceKind[] {
  const taken = new Set(resources.map(kindOf));

  return resourceKinds.filter((kind) => kind === "other" || !taken.has(kind));
}

export function resourceLabel(
  resource: Pick<Resource, "name" | "isRefiningMaterial">,
  kindLabel: (kind: FixedResourceKind) => string,
): string {
  const kind = kindOf(resource);

  return kind === "other" ? resource.name : kindLabel(kind);
}

export const resourceChangeTypes = ["increase", "decrease"] as const;

export type ResourceChangeType = (typeof resourceChangeTypes)[number];

export type ResourceChange = {
  id: string;
  type: ResourceChangeType;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  fromRefining: boolean;
  shipmentNumber: string | undefined;
  note: string;
  byName: string;
  at: IsoTimestamp;
};

export function createResourceSchema(messages: { required: string; quantityInvalid: string }) {
  return z
    .object({
      project: z.string().min(1, messages.required),
      kind: z.string().refine((value): boolean => isResourceKind(value), messages.required),
      name: z.string().trim().max(NAME_MAX_LENGTH),
      initialQuantity: z.number({ error: messages.required }).min(0, messages.quantityInvalid),
    })
    .superRefine((values, context) => {
      if (values.kind === "other" && values.name === "") {
        context.addIssue({ code: "custom", path: ["name"], message: messages.required });
      }
    });
}

export type ResourceValues = z.infer<ReturnType<typeof createResourceSchema>>;

export function createResourceChangeSchema(
  messages: { required: string; quantityInvalid: string; quantityTooMuch: string },
  available?: number,
) {
  return z
    .object({
      quantity: z.number({ error: messages.required }).positive(messages.quantityInvalid),
      refiningOperationId: z.string(),
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

export function resourceFromApi(resource: ApiSchema<"Resource">): Resource {
  return {
    id: String(resource.id),
    project: String(resource.project),
    projectName: resource.project_name,
    name: resource.name,
    initialQuantity: fromDecimal(resource.initial_quantity),
    currentQuantity: fromDecimal(resource.current_quantity),
    isRefiningMaterial: resource.is_refining_material ?? false,
  };
}

export function resourceToApi(values: ResourceValues) {
  return {
    project: Number(values.project),
    name: values.kind === "other" ? values.name : values.kind,
    initial_quantity: toDecimal(values.initialQuantity),
    is_refining_material: values.kind === "mercury",
  };
}

export function resourceErrorsFromApi(
  errors: BackendFieldErrors,
): FieldErrors<keyof ResourceValues> {
  return {
    ...(errors.project === undefined ? {} : { project: errors.project }),
    ...(errors.name === undefined ? {} : { name: errors.name }),
    ...(errors.initial_quantity === undefined ? {} : { initialQuantity: errors.initial_quantity }),
    ...(errors.is_refining_material === undefined ? {} : { kind: errors.is_refining_material }),
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
    shipmentNumber: typeof entry.shipment_number === "string" ? entry.shipment_number : undefined,
    note: entry.note,
    byName: entry.created_by_name,
    at: entry.created_at,
  };
}

export function resourceChangeToApi(values: ResourceChangeValues) {
  return {
    quantity: toDecimal(values.quantity),
    note: values.note,
    ...(values.refiningOperationId === ""
      ? {}
      : { refining_operation: Number(values.refiningOperationId) }),
  };
}

export function resourceChangeErrorsFromApi(
  errors: BackendFieldErrors,
): FieldErrors<keyof ResourceChangeValues> {
  return {
    ...(errors.quantity === undefined ? {} : { quantity: errors.quantity }),
    ...(errors.note === undefined ? {} : { note: errors.note }),
    ...(errors.refining_operation === undefined
      ? {}
      : { refiningOperationId: errors.refining_operation }),
  };
}
