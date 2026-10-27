import { z } from "zod";
import type { BackendFieldErrors, FieldErrors } from "@/lib/api/client";
import { NOTES_MAX_LENGTH } from "./shipments";

export function createCancelShipmentSchema() {
  return z.object({
    reason: z.string().max(NOTES_MAX_LENGTH),
  });
}

export type CancelShipmentValues = z.infer<ReturnType<typeof createCancelShipmentSchema>>;

export function cancelToApi(values: CancelShipmentValues) {
  return { reason: values.reason.trim() };
}

export function cancelErrorsFromApi(
  errors: BackendFieldErrors,
): FieldErrors<keyof CancelShipmentValues> {
  return errors.reason === undefined ? {} : { reason: errors.reason };
}
