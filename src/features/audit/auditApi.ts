import { apiClient, unwrap } from "@/lib/api/client";
import { fetchAllPages, MAX_PAGE_SIZE, PAGE_SIZE, toPage } from "@/lib/api/pagination";
import type { Page } from "@/lib/api/pagination";
import { isRecordId } from "@/lib/projects";
import { auditedModelFromApi, auditEntryFromApi, auditUserFromApi } from "./audit";
import type { AuditChoice, AuditEntry, AuditFilter } from "./audit";

function numberOr(value: string): number | undefined {
  return value === "" ? undefined : Number(value);
}

function textOr(value: string | undefined): string | undefined {
  return value === "" ? undefined : value;
}

export async function getAuditPage(filter: AuditFilter, page: number): Promise<Page<AuditEntry>> {
  const result = await apiClient.GET("/api/v1/audit-logs/", {
    params: {
      query: {
        page,
        page_size: PAGE_SIZE,
        search: textOr(filter.search),
        action: filter.action,
        model: textOr(filter.model),
        user: numberOr(filter.user),
        project: numberOr(filter.project),
        timestamp__date__gte: textOr(filter.from),
        timestamp__date__lte: textOr(filter.to),
      },
    },
  });

  return toPage(unwrap(result), page, auditEntryFromApi);
}

export async function getAuditEntry(id: string): Promise<AuditEntry | undefined> {
  if (!isRecordId(id)) {
    return undefined;
  }

  const result = await apiClient.GET("/api/v1/audit-logs/{id}/", {
    params: { path: { id: Number(id) } },
  });

  return result.response.status === 404 ? undefined : auditEntryFromApi(unwrap(result));
}

export async function getAuditedModels(): Promise<readonly AuditChoice[]> {
  return unwrap(await apiClient.GET("/api/v1/audit-logs/models/")).map(auditedModelFromApi);
}

export async function getAuditUsers(): Promise<readonly AuditChoice[]> {
  const users = await fetchAllPages(async (page) =>
    unwrap(
      await apiClient.GET("/api/v1/users/", {
        params: { query: { page, page_size: MAX_PAGE_SIZE } },
      }),
    ),
  );

  return users.map(auditUserFromApi);
}
