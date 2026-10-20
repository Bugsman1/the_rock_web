import type { PdfFile } from "@/components/ui/PdfPreview";
import type { Locale } from "@/i18n/locales";
import { apiClient, attachmentFileName, saveFailed, saveOutcome, unwrap } from "@/lib/api/client";
import type { SaveResult } from "@/lib/api/client";
import { fetchAllPages, MAX_PAGE_SIZE, PAGE_SIZE, toPage } from "@/lib/api/pagination";
import type { Page } from "@/lib/api/pagination";
import { isRecordId } from "@/lib/projects";
import type { ProjectId } from "@/lib/projects";
import {
  newSettlementToApi,
  settlementAmountsToApi,
  settlementErrorsFromApi,
  settlementFromApi,
} from "./settlements";
import type { NewSettlementValues, Settlement, SettlementAmountsValues } from "./settlements";

type SaveSettlementResult = SaveResult<keyof NewSettlementValues>;

type Failure = Extract<SaveSettlementResult, { ok: false }>;

type SettlementFilter = {
  customer?: string;
  project?: ProjectId;
};

function filterToQuery({ customer, project }: SettlementFilter) {
  return {
    ...(customer === undefined ? {} : { customer: Number(customer) }),
    ...(project === undefined ? {} : { project: Number(project) }),
  };
}

export async function getSettlementPage(
  search: string,
  page: number,
  project: ProjectId,
): Promise<Page<Settlement>> {
  const result = await apiClient.GET("/api/v1/settlements/", {
    params: {
      query: {
        ordering: "-created_at",
        page,
        page_size: PAGE_SIZE,
        ...filterToQuery({ project }),
        ...(search.trim() === "" ? {} : { search: search.trim() }),
      },
    },
  });

  return toPage(unwrap(result), page, settlementFromApi);
}

export async function getSettlements(
  filter: SettlementFilter = {},
): Promise<readonly Settlement[]> {
  const settlements = await fetchAllPages(async (page) =>
    unwrap(
      await apiClient.GET("/api/v1/settlements/", {
        params: { query: { ...filterToQuery(filter), page, page_size: MAX_PAGE_SIZE } },
      }),
    ),
  );

  return settlements.map(settlementFromApi);
}

export async function getSettlement(id: string): Promise<Settlement | undefined> {
  if (!isRecordId(id)) {
    return undefined;
  }

  const result = await apiClient.GET("/api/v1/settlements/{id}/", {
    params: { path: { id: Number(id) } },
  });

  return result.response.status === 404 ? undefined : settlementFromApi(unwrap(result));
}

export async function createSettlement(
  customerId: string,
  values: NewSettlementValues,
): Promise<{ ok: true; id: string } | Failure> {
  const { data, response, error } = await apiClient.POST("/api/v1/settlements/", {
    body: newSettlementToApi(customerId, values),
  });

  if (data !== undefined) {
    return { ok: true, id: String(data.id) };
  }

  const outcome = saveOutcome(response, error, settlementErrorsFromApi);

  return outcome.ok ? saveFailed : outcome;
}

export async function updateSettlementAmounts(
  id: string,
  values: SettlementAmountsValues,
): Promise<SaveResult<keyof SettlementAmountsValues>> {
  const { response, error } = await apiClient.PATCH("/api/v1/settlements/{id}/", {
    params: { path: { id: Number(id) } },
    body: settlementAmountsToApi(values),
  });

  return saveOutcome(response, error, settlementErrorsFromApi);
}

export async function deleteSettlement(id: string): Promise<boolean> {
  const { response } = await apiClient.DELETE("/api/v1/settlements/{id}/", {
    params: { path: { id: Number(id) } },
  });

  return response.ok;
}

export async function getSettlementPdf(
  settlement: Pick<Settlement, "id">,
  language: Locale,
  fallbackName: string,
): Promise<PdfFile | undefined> {
  const { data, response } = await apiClient.GET("/api/v1/settlements/{id}/pdf/", {
    params: { path: { id: Number(settlement.id) }, query: { format: "pdf", lang: language } },
    parseAs: "blob",
  });

  return data === undefined
    ? undefined
    : {
        file: data,
        fileName: attachmentFileName(response.headers.get("Content-Disposition")) ?? fallbackName,
      };
}
