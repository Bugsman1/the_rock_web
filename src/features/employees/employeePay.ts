import { z } from "zod";
import type { BackendFieldErrors, FieldErrors } from "@/lib/api/client";
import { toMoneyDecimal } from "@/lib/format";
import { requiredIsoDate } from "./employees";

export function createRaiseSchema(messages: {
  required: string;
  dateInvalid: string;
  amountInvalid: string;
}) {
  return z.object({
    amount: z.number({ error: messages.amountInvalid }).positive(messages.amountInvalid),
    from: requiredIsoDate(messages),
  });
}

export type RaiseValues = z.infer<ReturnType<typeof createRaiseSchema>>;

const raiseFields: readonly (keyof RaiseValues)[] = ["amount", "from"];

export function isRaiseField(value: string): value is keyof RaiseValues {
  return raiseFields.some((field) => field === value);
}

export function raiseToApi(employee: string, values: RaiseValues) {
  return {
    employee: Number(employee),
    monthly_salary: toMoneyDecimal(values.amount),
    effective_from: values.from,
  };
}

export function refiningCostToApi(employee: string, values: RaiseValues) {
  return {
    employee: Number(employee),
    cost_per_gram: toMoneyDecimal(values.amount),
    effective_from: values.from,
  };
}

export function raiseErrorsFromApi(errors: BackendFieldErrors): FieldErrors<keyof RaiseValues> {
  const amount = errors.monthly_salary ?? errors.cost_per_gram;

  return {
    ...(amount === undefined ? {} : { amount }),
    ...(errors.effective_from === undefined ? {} : { from: errors.effective_from }),
  };
}
