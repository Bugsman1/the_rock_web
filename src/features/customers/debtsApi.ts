import { apiClient, saveOutcome, unwrap } from "@/lib/api/client";
import type { SaveResult } from "@/lib/api/client";
import { fetchAllPages, MAX_PAGE_SIZE } from "@/lib/api/pagination";
import {
  debtFromApi,
  debtHistoryFromApi,
  increaseErrorsFromApi,
  increaseToApi,
  newDebtErrorsFromApi,
  newDebtToApi,
  paymentErrorsFromApi,
  paymentToApi,
} from "./debts";
import type {
  CustomerDebt,
  DebtHistoryEntry,
  IncreaseValues,
  NewDebtValues,
  PaymentValues,
} from "./debts";

function idempotent(key: string) {
  return { header: { "Idempotency-Key": key } };
}

export async function getCustomerDebts(customerId: string): Promise<readonly CustomerDebt[]> {
  const debts = await fetchAllPages(async (page) =>
    unwrap(
      await apiClient.GET("/api/v1/customer-debts/", {
        params: { query: { customer: Number(customerId), page, page_size: MAX_PAGE_SIZE } },
      }),
    ),
  );

  return debts.map(debtFromApi);
}

export async function getDebtHistory(debtId: string): Promise<readonly DebtHistoryEntry[]> {
  const history = unwrap(
    await apiClient.GET("/api/v1/customer-debts/{id}/history/", {
      params: { path: { id: Number(debtId) } },
    }),
  );

  return history.map(debtHistoryFromApi);
}

export async function addCustomerDebt(
  customerId: string,
  values: NewDebtValues,
  key: string,
): Promise<SaveResult<keyof NewDebtValues>> {
  const { response, error } = await apiClient.POST("/api/v1/customer-debts/", {
    params: idempotent(key),
    body: newDebtToApi(customerId, values),
  });

  return saveOutcome(response, error, newDebtErrorsFromApi);
}

export async function increaseDebt(
  debtId: string,
  values: IncreaseValues,
  key: string,
): Promise<SaveResult<keyof IncreaseValues>> {
  const { response, error } = await apiClient.POST("/api/v1/debt-increases/", {
    params: idempotent(key),
    body: increaseToApi(debtId, values),
  });

  return saveOutcome(response, error, increaseErrorsFromApi);
}

export async function payDebt(
  debtId: string,
  values: PaymentValues,
  key: string,
): Promise<SaveResult<keyof PaymentValues>> {
  const { response, error } = await apiClient.POST("/api/v1/debt-payments/", {
    params: idempotent(key),
    body: paymentToApi(debtId, values),
  });

  return saveOutcome(response, error, paymentErrorsFromApi);
}
