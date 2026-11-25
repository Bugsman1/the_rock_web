import { apiClient, deleteResult, saveFailed, saveOutcome, unwrap } from "@/lib/api/client";
import type { DeleteResult, SaveResult } from "@/lib/api/client";
import { fetchAllPages, MAX_PAGE_SIZE, PAGE_SIZE, toPage } from "@/lib/api/pagination";
import type { Page } from "@/lib/api/pagination";
import { transactionFromApi } from "@/lib/cashTransactions";
import type { CashTransaction } from "@/lib/cashTransactions";
import { isRecordId } from "@/lib/projects";
import type { ProjectId } from "@/lib/projects";
import {
  isRefinersHalfOfPay,
  payablesFromApi,
  profitAndLossFromApi,
  projectProfitFromApi,
  receivablesFromApi,
  returnErrorsFromApi,
  returnToApi,
  shipmentReturnsFromApi,
  summaryFromApi,
} from "./accounting";
import type {
  AccountingSummary,
  Payables,
  Period,
  ProfitAndLoss,
  ProjectProfit,
  Receivables,
  ReturnValues,
  ShipmentReturn,
} from "./accounting";

function reportQuery(period: Period, project?: ProjectId) {
  return {
    date__gte: period.from,
    date__lte: period.to,
    ...(project === undefined ? {} : { project: Number(project) }),
  };
}

export async function getProjectProfits(period: Period): Promise<readonly ProjectProfit[]> {
  const result = await apiClient.GET("/api/v1/accounting/profit-loss/", {
    params: { query: reportQuery(period) },
  });

  return unwrap(result).by_project.map(projectProfitFromApi);
}

export async function getProfitAndLoss(project: ProjectId, period: Period): Promise<ProfitAndLoss> {
  const result = await apiClient.GET("/api/v1/accounting/profit-loss/", {
    params: { query: reportQuery(period, project) },
  });

  return profitAndLossFromApi(unwrap(result));
}

export async function getSummary(
  project: ProjectId,
  period: Period,
): Promise<AccountingSummary | undefined> {
  const result = await apiClient.GET("/api/v1/accounting/summary/", {
    params: { query: reportQuery(period, project) },
  });
  const row = unwrap(result).find((summary) => String(summary.project) === project);

  return row === undefined ? undefined : summaryFromApi(row);
}

export async function getReceivables(project: ProjectId): Promise<Receivables> {
  const result = await apiClient.GET("/api/v1/accounting/receivables/", {
    params: { query: { project: Number(project) } },
  });

  return receivablesFromApi(unwrap(result));
}

export async function getPayables(project: ProjectId): Promise<Payables> {
  const result = await apiClient.GET("/api/v1/accounting/payables/", {
    params: { query: { project: Number(project) } },
  });

  return payablesFromApi(unwrap(result));
}

export async function getPendingPage(
  project: ProjectId,
  page: number,
): Promise<Page<CashTransaction>> {
  const result = await apiClient.GET("/api/v1/cash-transactions/", {
    params: { query: { project: Number(project), status: "pending", page, page_size: PAGE_SIZE } },
  });

  const pending = toPage(unwrap(result), page, transactionFromApi);

  return {
    ...pending,
    items: pending.items.filter((transaction) => !isRefinersHalfOfPay(transaction)),
  };
}

export async function getShipmentReturns(project: ProjectId): Promise<readonly ShipmentReturn[]> {
  const settlements = await fetchAllPages(async (page) =>
    unwrap(
      await apiClient.GET("/api/v1/settlements/", {
        params: { query: { project: Number(project), page, page_size: MAX_PAGE_SIZE } },
      }),
    ),
  );

  return settlements.flatMap(shipmentReturnsFromApi);
}

export async function approveTransaction(id: string): Promise<DeleteResult> {
  const { response, error } = await apiClient.POST("/api/v1/cash-transactions/{id}/approve/", {
    params: { path: { id: Number(id) } },
  });

  return deleteResult(response, error);
}

export async function rejectTransaction(id: string): Promise<DeleteResult> {
  const { response, error } = await apiClient.POST("/api/v1/cash-transactions/{id}/reject/", {
    params: { path: { id: Number(id) } },
  });

  return deleteResult(response, error);
}

export async function saveReturn(
  settlement: string,
  shipment: string,
  values: ReturnValues,
): Promise<SaveResult<keyof ReturnValues>> {
  if (!isRecordId(settlement) || !isRecordId(shipment)) {
    return saveFailed;
  }

  const { response, error } = await apiClient.PATCH(
    "/api/v1/settlements/{settlement_pk}/shipments/{shipment_pk}/return/",
    {
      params: { path: { settlement_pk: Number(settlement), shipment_pk: Number(shipment) } },
      body: returnToApi(values),
    },
  );

  return saveOutcome(response, error, returnErrorsFromApi);
}

export async function getPendingTransaction(
  project: ProjectId,
  id: string,
): Promise<CashTransaction | undefined> {
  if (!isRecordId(id)) {
    return undefined;
  }

  const result = await apiClient.GET("/api/v1/cash-transactions/{id}/", {
    params: { path: { id: Number(id) } },
  });

  if (result.response.status === 404) {
    return undefined;
  }

  const transaction = transactionFromApi(unwrap(result));

  return transaction.project === project && transaction.status === "pending"
    ? transaction
    : undefined;
}
