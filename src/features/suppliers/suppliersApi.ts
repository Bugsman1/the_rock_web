import {
  apiClient,
  deleteResult,
  idempotent,
  saveFailed,
  saveOutcome,
  unwrap,
} from "@/lib/api/client";
import type { DeleteResult, SaveResult } from "@/lib/api/client";
import { PAGE_SIZE, toPage } from "@/lib/api/pagination";
import type { Page } from "@/lib/api/pagination";
import type { IsoTimestamp } from "@/lib/format";
import { isRecordId } from "@/lib/projects";
import {
  accountEntryFromApi,
  deliveryChangesToApi,
  deliveryErrorsFromApi,
  deliveryFromApi,
  newDeliveryToApi,
  paymentErrorsFromApi,
  paymentFromApi,
  paymentToApi,
} from "./supplierAccount";
import type {
  AccountEntry,
  DeliveryValues,
  PaymentValues,
  SupplierDelivery,
  SupplierPayment,
} from "./supplierAccount";
import { supplierErrorsFromApi, supplierFromApi, supplierToApi } from "./suppliers";
import type { BalanceStatus, Supplier, SupplierValues } from "./suppliers";

export type SupplierListFilter = {
  search: string;
  status: BalanceStatus | undefined;
};

export async function getSupplierPage(
  { search, status }: SupplierListFilter,
  page: number,
): Promise<Page<Supplier>> {
  const result = await apiClient.GET("/api/v1/suppliers/", {
    params: {
      query: {
        ordering: "name",
        page,
        page_size: PAGE_SIZE,
        ...(search === "" ? {} : { search }),
        ...(status === undefined ? {} : { balance_status: status }),
      },
    },
  });

  return toPage(unwrap(result), page, supplierFromApi);
}

export async function getSupplier(id: string): Promise<Supplier | undefined> {
  if (!isRecordId(id)) {
    return undefined;
  }

  const result = await apiClient.GET("/api/v1/suppliers/{id}/", {
    params: { path: { id: Number(id) } },
  });

  return result.response.status === 404 ? undefined : supplierFromApi(unwrap(result));
}

export async function getSupplierAccount(id: string): Promise<readonly AccountEntry[]> {
  const history = unwrap(
    await apiClient.GET("/api/v1/suppliers/{id}/history/", {
      params: { path: { id: Number(id) } },
    }),
  );

  return history.map(accountEntryFromApi);
}

type SavedSupplier =
  { ok: true; id: string } | Extract<SaveResult<keyof SupplierValues>, { ok: false }>;

export async function createSupplier(values: SupplierValues, key: string): Promise<SavedSupplier> {
  const { data, response, error } = await apiClient.POST("/api/v1/suppliers/", {
    params: idempotent(key),
    body: supplierToApi(values),
  });

  if (data !== undefined) {
    return { ok: true, id: String(data.id) };
  }

  const outcome = saveOutcome(response, error, supplierErrorsFromApi);

  return outcome.ok ? saveFailed : outcome;
}

export async function updateSupplier(
  id: string,
  values: SupplierValues,
): Promise<SaveResult<keyof SupplierValues>> {
  const { response, error } = await apiClient.PATCH("/api/v1/suppliers/{id}/", {
    params: { path: { id: Number(id) } },
    body: supplierToApi(values),
  });

  return saveOutcome(response, error, supplierErrorsFromApi);
}

export async function deleteSupplier(id: string): Promise<DeleteResult> {
  const { response, error } = await apiClient.DELETE("/api/v1/suppliers/{id}/", {
    params: { path: { id: Number(id) } },
  });

  return deleteResult(response, error);
}

export async function getPayment(id: string): Promise<SupplierPayment | undefined> {
  if (!isRecordId(id)) {
    return undefined;
  }

  const result = await apiClient.GET("/api/v1/supplier-payments/{id}/", {
    params: { path: { id: Number(id) } },
  });

  return result.response.status === 404 ? undefined : paymentFromApi(unwrap(result));
}

export async function addPayment(
  supplier: string,
  values: PaymentValues,
  at: IsoTimestamp,
  key: string,
): Promise<SaveResult<keyof PaymentValues>> {
  const { response, error } = await apiClient.POST("/api/v1/supplier-payments/", {
    params: idempotent(key),
    body: { ...paymentToApi(values, at), supplier: Number(supplier) },
  });

  return saveOutcome(response, error, paymentErrorsFromApi);
}

export async function updatePayment(
  id: string,
  values: PaymentValues,
  at: IsoTimestamp,
): Promise<SaveResult<keyof PaymentValues>> {
  const { response, error } = await apiClient.PATCH("/api/v1/supplier-payments/{id}/", {
    params: { path: { id: Number(id) } },
    body: paymentToApi(values, at),
  });

  return saveOutcome(response, error, paymentErrorsFromApi);
}

export async function deletePayment(id: string): Promise<DeleteResult> {
  const { response, error } = await apiClient.DELETE("/api/v1/supplier-payments/{id}/", {
    params: { path: { id: Number(id) } },
  });

  return deleteResult(response, error);
}

export async function getDelivery(id: string): Promise<SupplierDelivery | undefined> {
  if (!isRecordId(id)) {
    return undefined;
  }

  const result = await apiClient.GET("/api/v1/supplier-deliveries/{id}/", {
    params: { path: { id: Number(id) } },
  });

  return result.response.status === 404 ? undefined : deliveryFromApi(unwrap(result));
}

export async function addDelivery(
  values: DeliveryValues,
  at: IsoTimestamp,
  key: string,
): Promise<SaveResult<keyof DeliveryValues>> {
  const { response, error } = await apiClient.POST("/api/v1/supplier-deliveries/", {
    params: idempotent(key),
    body: newDeliveryToApi(values, at),
  });

  return saveOutcome(response, error, deliveryErrorsFromApi);
}

export async function updateDelivery(
  delivery: SupplierDelivery,
  values: DeliveryValues,
  at: IsoTimestamp,
): Promise<SaveResult<keyof DeliveryValues>> {
  const { response, error } = await apiClient.PATCH("/api/v1/supplier-deliveries/{id}/", {
    params: { path: { id: Number(delivery.id) } },
    body: deliveryChangesToApi(values, at, delivery.isInitial),
  });

  return saveOutcome(response, error, deliveryErrorsFromApi);
}

export async function deleteDelivery(id: string): Promise<DeleteResult> {
  const { response, error } = await apiClient.DELETE("/api/v1/supplier-deliveries/{id}/", {
    params: { path: { id: Number(id) } },
  });

  return deleteResult(response, error);
}
