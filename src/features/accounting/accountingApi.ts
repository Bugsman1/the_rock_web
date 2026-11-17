import { apiClient, unwrap } from "@/lib/api/client";
import type { ProjectId } from "@/lib/projects";
import {
  groupedFromApi,
  profitAndLossFromApi,
  projectProfitFromApi,
  summaryFromApi,
} from "./accounting";
import type {
  AccountingSummary,
  ExpenseGroup,
  GroupedAmounts,
  IncomeGroup,
  Period,
  ProfitAndLoss,
  ProjectProfit,
} from "./accounting";

function reportQuery(period: Period, project?: ProjectId) {
  return {
    approved: true,
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

export async function getSummary(project: ProjectId, period: Period): Promise<AccountingSummary> {
  const result = await apiClient.GET("/api/v1/accounting/summary/", {
    params: { query: reportQuery(period, project) },
  });

  return summaryFromApi(unwrap(result));
}

export async function getIncome(
  project: ProjectId,
  period: Period,
  groupBy: IncomeGroup,
): Promise<GroupedAmounts> {
  const result = await apiClient.GET("/api/v1/accounting/income/", {
    params: { query: { ...reportQuery(period, project), group_by: groupBy } },
  });

  return groupedFromApi(unwrap(result));
}

export async function getExpenses(
  project: ProjectId,
  period: Period,
  groupBy: ExpenseGroup,
): Promise<GroupedAmounts> {
  const result = await apiClient.GET("/api/v1/accounting/expenses/", {
    params: { query: { ...reportQuery(period, project), group_by: groupBy } },
  });

  return groupedFromApi(unwrap(result));
}
