import { apiClient, idempotent, saveOutcome, unwrap } from "@/lib/api/client";
import type { SaveResult } from "@/lib/api/client";
import { fetchAllPages, MAX_PAGE_SIZE } from "@/lib/api/pagination";
import type { IsoTimestamp } from "@/lib/format";
import {
  debtErrorsFromApi,
  debtFromApi,
  debtPaymentErrorsFromApi,
  debtPaymentFromApi,
  debtPaymentToApi,
  debtToApi,
} from "./employeeDebts";
import type { Debt, DebtPayment, DebtValues } from "./employeeDebts";
import type { WithdrawalValues } from "./employees";
import { deleteResult } from "./employeesApi";
import type { DeleteResult } from "./employeesApi";

export async function getDebts(employee: string): Promise<readonly Debt[]> {
  const debts = await fetchAllPages(async (page) =>
    unwrap(
      await apiClient.GET("/api/v1/employee-debts/", {
        params: { query: { employee: Number(employee), page, page_size: MAX_PAGE_SIZE } },
      }),
    ),
  );

  return debts.map(debtFromApi);
}

export async function addDebt(
  employee: string,
  values: DebtValues,
  at: IsoTimestamp,
  key: string,
): Promise<SaveResult<keyof DebtValues>> {
  const { response, error } = await apiClient.POST("/api/v1/employee-debts/", {
    params: idempotent(key),
    body: { ...debtToApi(values, at), employee: Number(employee) },
  });

  return saveOutcome(response, error, debtErrorsFromApi);
}

export async function updateDebt(
  id: string,
  values: DebtValues,
  at: IsoTimestamp,
): Promise<SaveResult<keyof DebtValues>> {
  const { response, error } = await apiClient.PATCH("/api/v1/employee-debts/{id}/", {
    params: { path: { id: Number(id) } },
    body: debtToApi(values, at),
  });

  return saveOutcome(response, error, debtErrorsFromApi);
}

export async function deleteDebt(id: string): Promise<DeleteResult> {
  const { response, error } = await apiClient.DELETE("/api/v1/employee-debts/{id}/", {
    params: { path: { id: Number(id) } },
  });

  return deleteResult(response, error);
}

export async function getDebtPayments(employee: string): Promise<readonly DebtPayment[]> {
  const payments = await fetchAllPages(async (page) =>
    unwrap(
      await apiClient.GET("/api/v1/employee-debt-payments/", {
        params: { query: { employee: Number(employee), page, page_size: MAX_PAGE_SIZE } },
      }),
    ),
  );

  return payments.map(debtPaymentFromApi);
}

export async function addDebtPayment(
  employee: string,
  values: WithdrawalValues,
  at: IsoTimestamp,
  key: string,
): Promise<SaveResult<keyof WithdrawalValues>> {
  const { response, error } = await apiClient.POST("/api/v1/employee-debt-payments/", {
    params: idempotent(key),
    body: { ...debtPaymentToApi(values, at), employee: Number(employee) },
  });

  return saveOutcome(response, error, debtPaymentErrorsFromApi);
}

export async function updateDebtPayment(
  id: string,
  values: WithdrawalValues,
  at: IsoTimestamp,
): Promise<SaveResult<keyof WithdrawalValues>> {
  const { response, error } = await apiClient.PATCH("/api/v1/employee-debt-payments/{id}/", {
    params: { path: { id: Number(id) } },
    body: debtPaymentToApi(values, at),
  });

  return saveOutcome(response, error, debtPaymentErrorsFromApi);
}

export async function deleteDebtPayment(id: string): Promise<DeleteResult> {
  const { response, error } = await apiClient.DELETE("/api/v1/employee-debt-payments/{id}/", {
    params: { path: { id: Number(id) } },
  });

  return deleteResult(response, error);
}
