import { apiClient, saveFailed, saveOutcome } from "@/lib/api/client";
import type { SaveResult } from "@/lib/api/client";
import { customerToApi, matchCustomer } from "@/lib/customers";
import { getCustomersWithPhone } from "@/lib/customersApi";
import { combineDateAndTime } from "@/lib/datetime";
import { shipmentErrorsFromApi, shipmentToApi } from "./shipments";
import type { NewShipmentValues } from "./shipments";

type SaveShipmentResult = SaveResult<keyof NewShipmentValues>;

type Failure = Extract<SaveShipmentResult, { ok: false }>;

async function customerIdFor(
  values: NewShipmentValues,
  phoneTaken: (owner: string) => string,
): Promise<{ ok: true; id: string } | Failure> {
  const match = matchCustomer(
    await getCustomersWithPhone(values.phone),
    values.customerName,
    values.phone,
  );

  if (match.kind === "existing") {
    return { ok: true, id: match.customer.id };
  }

  if (match.kind === "phoneTaken") {
    return { ok: false, fieldErrors: { phone: phoneTaken(match.owner.name) }, failed: false };
  }

  const { data } = await apiClient.POST("/api/v1/customers/", {
    body: customerToApi({ name: values.customerName, phone: values.phone }),
  });

  return data === undefined ? saveFailed : { ok: true, id: String(data.id) };
}

export async function createShipment(
  values: NewShipmentValues,
  phoneTaken: (owner: string) => string,
): Promise<SaveShipmentResult> {
  const arrivedAt = combineDateAndTime(values.arrivalDate, values.arrivalTime);

  if (arrivedAt === undefined) {
    return saveFailed;
  }

  const customer = await customerIdFor(values, phoneTaken);

  if (!customer.ok) {
    return customer;
  }

  const { response, error } = await apiClient.POST("/api/v1/shipments/", {
    body: shipmentToApi(values, { customerId: customer.id, arrivedAt }),
  });

  return saveOutcome(response, error, shipmentErrorsFromApi);
}
