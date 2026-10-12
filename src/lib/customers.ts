import { z } from "zod";
import type { ApiSchema, BackendFieldErrors, FieldErrors } from "./api/client";
import type { IsoTimestamp } from "./format";
import { formatPhone, isSamePhone, isValidPhone } from "./phone";

export type Customer = {
  id: string;
  name: string;
  phone: string;
  addedAt: IsoTimestamp;
};

const NAME_MAX_LENGTH = 120;

export function createCustomerSchema(messages: { required: string; phoneInvalid: string }) {
  return z.object({
    name: z.string().trim().min(1, messages.required).max(NAME_MAX_LENGTH),
    phone: z
      .string()
      .trim()
      .min(1, { message: messages.required, abort: true })
      .refine(isValidPhone, messages.phoneInvalid),
  });
}

export type CustomerValues = z.infer<ReturnType<typeof createCustomerSchema>>;

export function findCustomer(customers: readonly Customer[], name: string): Customer | undefined {
  return customers.find((customer) => customer.name === name);
}

export function isPhoneTaken(
  customers: readonly Customer[],
  phone: string,
  exceptId?: string,
): boolean {
  return customers.some(
    (customer) => customer.id !== exceptId && isSamePhone(customer.phone, phone),
  );
}

type CustomerMatch =
  | { kind: "existing"; customer: Customer }
  | { kind: "new" }
  | { kind: "phoneTaken"; owner: Customer };

function sameName(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}

export function matchCustomer(
  customers: readonly Customer[],
  name: string,
  phone: string,
): CustomerMatch {
  const owner = customers.find((customer) => isSamePhone(customer.phone, phone));

  if (owner === undefined) {
    return { kind: "new" };
  }

  return sameName(owner.name, name)
    ? { kind: "existing", customer: owner }
    : { kind: "phoneTaken", owner };
}

export function customerFromApi(customer: ApiSchema<"Customer">): Customer {
  return {
    id: String(customer.id),
    name: customer.full_name,
    phone: customer.phone,
    addedAt: customer.created_at,
  };
}

export function customerToApi({ name, phone }: CustomerValues) {
  return { full_name: name.trim(), phone: formatPhone(phone) };
}

export function customerErrorsFromApi(
  errors: BackendFieldErrors,
): FieldErrors<keyof CustomerValues> {
  return {
    ...(errors.full_name === undefined ? {} : { name: errors.full_name }),
    ...(errors.phone === undefined ? {} : { phone: errors.phone }),
  };
}
