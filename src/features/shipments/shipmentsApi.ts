import { apiClient, notFound, saveFailed, saveOutcome, unwrap } from "@/lib/api/client";
import type { SaveResult } from "@/lib/api/client";
import { customerToApi, matchCustomer } from "@/lib/customers";
import { getCustomersWithPhone } from "@/lib/customersApi";
import type { Locale } from "@/i18n/locales";
import { combineDateAndTime } from "@/lib/datetime";
import type { IsoTimestamp } from "@/lib/format";
import { isRecordId } from "@/lib/projects";
import {
  invoiceFileName,
  newShipmentToApi,
  paymentErrorsFromApi,
  paymentToApi,
  shipmentDetailFromApi,
  shipmentErrorsFromApi,
  shipmentToApi,
} from "./shipments";
import type { NewShipmentValues, PaymentValues, ShipmentDetail } from "./shipments";

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
): Promise<{ ok: true; id: string } | Failure> {
  const arrivedAt = combineDateAndTime(values.arrivalDate, values.arrivalTime);

  if (arrivedAt === undefined) {
    return saveFailed;
  }

  const customer = await customerIdFor(values, phoneTaken);

  if (!customer.ok) {
    return customer;
  }

  const { data, response, error } = await apiClient.POST("/api/v1/shipments/", {
    body: newShipmentToApi(values, { customerId: customer.id, arrivedAt }),
  });

  if (data !== undefined) {
    return { ok: true, id: String(data.id) };
  }

  const outcome = saveOutcome(response, error, shipmentErrorsFromApi);

  return outcome.ok ? saveFailed : outcome;
}

export async function updateShipment(
  shipmentId: string,
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

  const { response, error } = await apiClient.PATCH("/api/v1/shipments/{id}/", {
    params: { path: { id: Number(shipmentId) } },
    body: shipmentToApi(values, { customerId: customer.id, arrivedAt }),
  });

  return saveOutcome(response, error, shipmentErrorsFromApi);
}

export async function getShipment(shipmentId: string): Promise<ShipmentDetail> {
  if (!isRecordId(shipmentId)) {
    notFound();
  }

  return shipmentDetailFromApi(
    unwrap(
      await apiClient.GET("/api/v1/shipments/{id}/", {
        params: { path: { id: Number(shipmentId) } },
      }),
    ),
  );
}

export async function addPayment(
  shipmentId: string,
  values: PaymentValues,
  paidAt: IsoTimestamp,
): Promise<SaveResult<keyof PaymentValues>> {
  const { response, error } = await apiClient.POST("/api/v1/shipment-payments/", {
    body: paymentToApi(values, shipmentId, paidAt),
  });

  return saveOutcome(response, error, paymentErrorsFromApi);
}

type Invoice = {
  file: Blob;
  fileName: string | undefined;
};

export async function getInvoice(shipmentId: string, locale: Locale): Promise<Invoice | undefined> {
  const { data, response } = await apiClient.GET("/api/v1/shipments/{id}/invoice/", {
    params: { path: { id: Number(shipmentId) }, query: { format: "pdf", lang: locale } },
    parseAs: "blob",
  });

  return data === undefined
    ? undefined
    : { file: data, fileName: invoiceFileName(response.headers.get("Content-Disposition")) };
}
