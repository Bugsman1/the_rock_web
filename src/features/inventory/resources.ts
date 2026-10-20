import { z } from "zod";
import type { ApiSchema, BackendFieldErrors, FieldErrors } from "@/lib/api/client";
import { fromDecimal, toDecimal } from "@/lib/format";
import type { IsoTimestamp } from "@/lib/format";
import type { ProjectId } from "@/lib/projects";

const NOTE_MAX_LENGTH = 500;
const QUANTITY_PRECISION = 1000;

export const resourceKinds = ["mercury", "water", "fuel"] as const;

export type ResourceKind = (typeof resourceKinds)[number];

export type Resource = {
  id: string;
  project: ProjectId;
  projectName: string;
  kind: ResourceKind;
  initialQuantity: number;
  currentQuantity: number;
  isRefiningMaterial: boolean;
};

const kindNames: Record<ResourceKind, readonly string[]> = {
  mercury: ["mercury", "mercure", "الزئبق", "زئبق"],
  water: ["water", "eau", "الماء", "ماء", "مياه"],
  fuel: [
    "fuel",
    "essence",
    "carburant",
    "gasoil",
    "الوقود",
    "وقود",
    "المازوت",
    "مازوت",
    "البنزين",
    "بنزين",
  ],
};

const TATWEEL = "ـ";

function normalizeName(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replaceAll(TATWEEL, "")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

export function kindNamed(name: string): ResourceKind | undefined {
  const normalized = normalizeName(name);

  return resourceKinds.find((kind) =>
    kindNames[kind].some((spelling) => normalizeName(spelling) === normalized),
  );
}

export function isResourceKind(value: string): value is ResourceKind {
  return resourceKinds.some((kind) => kind === value);
}

export function availableKinds(resources: readonly Resource[]): readonly ResourceKind[] {
  return resourceKinds.filter((kind) => !resources.some((resource) => resource.kind === kind));
}

export const resourceChangeTypes = ["increase", "decrease"] as const;

export type ResourceChangeType = (typeof resourceChangeTypes)[number];

export type ResourceChange = {
  id: string;
  type: ResourceChangeType | "initial" | "taken" | "returned";
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  fromRefining: boolean;
  shipmentNumber: string | undefined;
  grindingSequence: number | undefined;
  loss: number | undefined;
  note: string;
  byName: string;
  at: IsoTimestamp;
};

export function createResourceSchema(messages: { required: string; quantityInvalid: string }) {
  return z.object({
    project: z.string().min(1, messages.required),
    kind: z.string().refine((value): boolean => isResourceKind(value), messages.required),
    initialQuantity: z.number({ error: messages.required }).min(0, messages.quantityInvalid),
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
        initialQuantity: fromDecimal(resource.initial_quantity),
        currentQuantity: fromDecimal(resource.current_quantity),
        isRefiningMaterial,
      };
}

export function resourceToApi(values: ResourceValues) {
  return {
    project: Number(values.project),
    name: values.kind,
    initial_quantity: toDecimal(values.initialQuantity),
    is_refining_material: values.kind === "mercury",
  };
}

export function resourceErrorsFromApi(
  errors: BackendFieldErrors,
): FieldErrors<keyof ResourceValues> {
  return {
    ...(errors.project === undefined ? {} : { project: errors.project }),
    ...(errors.initial_quantity === undefined ? {} : { initialQuantity: errors.initial_quantity }),
    ...(errors.name === undefined ? {} : { kind: errors.name }),
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
    shipmentNumber: entry.shipment_number ?? undefined,
    grindingSequence: entry.grinding_sequence ?? undefined,
    loss: entry.loss === null ? undefined : fromDecimal(entry.loss),
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
