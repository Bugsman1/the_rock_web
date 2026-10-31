import { z } from "zod";
import type { ApiSchema, BackendFieldErrors, FieldErrors } from "@/lib/api/client";
import { isIsoDate } from "@/lib/datetime";
import { requiredIsoDate } from "./employees";

export type Absence = {
  id: string;
  from: string;
  to: string;
  days: number;
  reason: string;
  byName: string | null;
};

const REASON_MAX_LENGTH = 200;

export function createAbsenceSchema(messages: {
  required: string;
  dateInvalid: string;
  endBeforeStart: string;
}) {
  return z
    .object({
      from: requiredIsoDate(messages),
      to: z.string().refine((value) => value === "" || isIsoDate(value), messages.dateInvalid),
      reason: z.string().trim().max(REASON_MAX_LENGTH),
    })
    .refine((values) => values.to === "" || values.to >= values.from, {
      message: messages.endBeforeStart,
      path: ["to"],
    });
}

export type AbsenceValues = z.infer<ReturnType<typeof createAbsenceSchema>>;

const absenceFields: readonly (keyof AbsenceValues)[] = ["from", "to", "reason"];

export function isAbsenceField(value: string): value is keyof AbsenceValues {
  return absenceFields.some((field) => field === value);
}

export function absenceFromApi(absence: ApiSchema<"EmployeeAbsence">): Absence {
  return {
    id: String(absence.id),
    from: absence.start_date,
    to: absence.end_date ?? absence.start_date,
    days: absence.days,
    reason: absence.reason ?? "",
    byName: absence.created_by_name,
  };
}

export function absenceToApi(values: AbsenceValues) {
  return {
    start_date: values.from,
    end_date: values.to === "" ? values.from : values.to,
    reason: values.reason,
  };
}

export function absenceErrorsFromApi(errors: BackendFieldErrors): FieldErrors<keyof AbsenceValues> {
  return {
    ...(errors.start_date === undefined ? {} : { from: errors.start_date }),
    ...(errors.end_date === undefined ? {} : { to: errors.end_date }),
    ...(errors.reason === undefined ? {} : { reason: errors.reason }),
  };
}
