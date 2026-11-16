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
import type { ProjectId } from "@/lib/projects";
import {
  balanceFromApi,
  categoryFromApi,
  transactionErrorsFromApi,
  transactionFromApi,
  transactionToApi,
} from "./cash";
import type {
  CashCategory,
  CashTransaction,
  ProjectBalance,
  TransactionType,
  TransactionValues,
} from "./cash";
import type { CashFilter } from "./cashQuery";

function numberOr(value: string): number | undefined {
  return value === "" ? undefined : Number(value);
}

function textOr(value: string): string | undefined {
  return value === "" ? undefined : value;
}

export async function getBalances(project?: ProjectId): Promise<readonly ProjectBalance[]> {
  const result = await apiClient.GET("/api/v1/cash-transactions/balance/", {
    params: { query: project === undefined ? {} : { project: Number(project) } },
  });

  return unwrap(result).map(balanceFromApi);
}

export async function getCategories(): Promise<readonly CashCategory[]> {
  return unwrap(await apiClient.GET("/api/v1/cash-transactions/categories/")).flatMap(
    categoryFromApi,
  );
}

export async function getTransactionPage(
  project: ProjectId,
  filter: CashFilter,
  page: number,
): Promise<Page<CashTransaction>> {
  const result = await apiClient.GET("/api/v1/cash-transactions/", {
    params: {
      query: {
        page,
        page_size: PAGE_SIZE,
        search: textOr(filter.search),
        transaction_type: filter.type,
        ...(filter.categories.length === 0 ? {} : { category__in: [...filter.categories] }),
        customer: numberOr(filter.customer),
        supplier: numberOr(filter.supplier),
        project: Number(project),
        transaction_date__date__gte: textOr(filter.from),
        transaction_date__date__lte: textOr(filter.to),
      },
    },
  });

  return toPage(unwrap(result), page, transactionFromApi);
}

export async function getTransaction(id: string): Promise<CashTransaction | undefined> {
  if (!isRecordId(id)) {
    return undefined;
  }

  const result = await apiClient.GET("/api/v1/cash-transactions/{id}/", {
    params: { path: { id: Number(id) } },
  });

  return result.response.status === 404 ? undefined : transactionFromApi(unwrap(result));
}

export async function createTransaction(
  project: ProjectId,
  type: TransactionType,
  values: TransactionValues,
  at: IsoTimestamp,
  key: string,
): Promise<SaveResult<keyof TransactionValues>> {
  const body = transactionToApi(project, type, values, at);

  if (body === undefined) {
    return saveFailed;
  }

  const { response, error } = await apiClient.POST("/api/v1/cash-transactions/", {
    params: idempotent(key),
    body,
  });

  return saveOutcome(response, error, transactionErrorsFromApi);
}

export async function updateTransaction(
  transaction: CashTransaction,
  values: TransactionValues,
  at: IsoTimestamp,
): Promise<SaveResult<keyof TransactionValues>> {
  const body = transactionToApi(transaction.project, transaction.type, values, at);

  if (body === undefined || !isRecordId(transaction.id)) {
    return saveFailed;
  }

  const { response, error } = await apiClient.PATCH("/api/v1/cash-transactions/{id}/", {
    params: { path: { id: Number(transaction.id) } },
    body,
  });

  return saveOutcome(response, error, transactionErrorsFromApi);
}

export async function deleteTransaction(id: string): Promise<DeleteResult> {
  const { response, error } = await apiClient.DELETE("/api/v1/cash-transactions/{id}/", {
    params: { path: { id: Number(id) } },
  });

  return deleteResult(response, error);
}
