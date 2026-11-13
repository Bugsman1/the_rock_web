import { z } from "zod";
import type { ApiSchema, BackendFieldErrors, FieldErrors } from "@/lib/api/client";
import { fromDecimal } from "@/lib/format";
import { formatPhone, isValidPhone, phoneToApi } from "@/lib/phone";
import { kindNamed } from "@/lib/resourceKinds";
import type { ResourceKind } from "@/lib/resourceKinds";

const NAME_MAX_LENGTH = 150;
const NOTE_MAX_LENGTH = 500;

export type SuppliedResource = {
  id: string;
  kind: ResourceKind | undefined;
  name: string;
  projectName: string;
};

export type Supplier = {
  id: string;
  name: string;
  phone: string;
  notes: string;
  paid: number;
  delivered: number;
  balance: number;
  resources: readonly SuppliedResource[];
};

export const balanceStatuses = ["advance", "owed", "settled"] as const;

export type BalanceStatus = (typeof balanceStatuses)[number];

export function isBalanceStatus(value: string): value is BalanceStatus {
  return balanceStatuses.some((status) => status === value);
}

export function balanceStatusOf(balance: number): BalanceStatus {
  if (balance > 0) return "advance";
  if (balance < 0) return "owed";

  return "settled";
}

export function createSupplierSchema(messages: { required: string; phoneInvalid: string }) {
  return z.object({
    name: z.string().trim().min(1, messages.required).max(NAME_MAX_LENGTH),
    phone: z
      .string()
      .trim()
      .refine((value) => value === "" || isValidPhone(value), messages.phoneInvalid),
    notes: z.string().trim().max(NOTE_MAX_LENGTH),
  });
}

export type SupplierValues = z.infer<ReturnType<typeof createSupplierSchema>>;

const supplierFields: readonly (keyof SupplierValues)[] = ["name", "phone", "notes"];

export function isSupplierField(value: string): value is keyof SupplierValues {
  return supplierFields.some((field) => field === value);
}

export function suppliedResourceFromApi(resource: ApiSchema<"SuppliedResource">): SuppliedResource {
  return {
    id: String(resource.id),
    kind: kindNamed(resource.name),
    name: resource.name,
    projectName: resource.project_name,
  };
}

export function supplierFromApi(supplier: ApiSchema<"Supplier">): Supplier {
  const phone = supplier.phone ?? "";

  return {
    id: String(supplier.id),
    name: supplier.name,
    phone: phone === "" ? "" : formatPhone(phone),
    notes: supplier.notes ?? "",
    paid: fromDecimal(supplier.paid_amount),
    delivered: fromDecimal(supplier.delivered_amount),
    balance: fromDecimal(supplier.balance),
    resources: supplier.resources.map(suppliedResourceFromApi),
  };
}

export function supplierToApi(values: SupplierValues) {
  return {
    name: values.name,
    phone: values.phone === "" ? "" : phoneToApi(values.phone),
    notes: values.notes,
  };
}

export function supplierErrorsFromApi(
  errors: BackendFieldErrors,
): FieldErrors<keyof SupplierValues> {
  return {
    ...(errors.name === undefined ? {} : { name: errors.name }),
    ...(errors.phone === undefined ? {} : { phone: errors.phone }),
    ...(errors.notes === undefined ? {} : { notes: errors.notes }),
  };
}
