import { apiClient, notFound, saveFailed, saveOutcome, unwrap } from "@/lib/api/client";
import type { SaveResult } from "@/lib/api/client";
import { fetchAllPages, MAX_PAGE_SIZE, toPage } from "@/lib/api/pagination";
import type { Page } from "@/lib/api/pagination";
import { isRecordId } from "@/lib/projects";
import type { ProjectId } from "@/lib/projects";
import {
  resourceChangeErrorsFromApi,
  resourceChangeFromApi,
  resourceChangeToApi,
  resourceErrorsFromApi,
  resourceFromApi,
  resourceToApi,
  supplierChoiceFromApi,
  supplierToApi,
} from "./resources";
import type {
  Resource,
  ResourceChange,
  ResourceChangeType,
  ResourceChangeValues,
  ResourceSupplierValues,
  ResourceValues,
  SupplierChoice,
} from "./resources";

export async function getResources(project?: ProjectId): Promise<readonly Resource[]> {
  const resources = await fetchAllPages(async (page) =>
    unwrap(
      await apiClient.GET("/api/v1/resources/", {
        params: {
          query: {
            ordering: "name",
            page,
            page_size: MAX_PAGE_SIZE,
            ...(project === undefined ? {} : { project: Number(project) }),
          },
        },
      }),
    ),
  );

  return resources.flatMap((resource) => resourceFromApi(resource) ?? []);
}

export async function getResource(id: string): Promise<Resource | undefined> {
  if (!isRecordId(id)) {
    return undefined;
  }

  const result = await apiClient.GET("/api/v1/resources/{id}/", {
    params: { path: { id: Number(id) } },
  });

  return result.response.status === 404 ? undefined : resourceFromApi(unwrap(result));
}

type SavedResource =
  { ok: true; id: string } | Extract<SaveResult<keyof ResourceValues>, { ok: false }>;

export async function createResource(values: ResourceValues): Promise<SavedResource> {
  const { data, response, error } = await apiClient.POST("/api/v1/resources/", {
    body: resourceToApi(values),
  });

  if (data !== undefined) {
    return { ok: true, id: String(data.id) };
  }

  const outcome = saveOutcome(response, error, resourceErrorsFromApi);

  return outcome.ok ? saveFailed : outcome;
}

export async function getSupplierChoices(): Promise<readonly SupplierChoice[]> {
  const suppliers = await fetchAllPages(async (page) =>
    unwrap(
      await apiClient.GET("/api/v1/suppliers/", {
        params: { query: { ordering: "name", page, page_size: MAX_PAGE_SIZE } },
      }),
    ),
  );

  return suppliers.map(supplierChoiceFromApi);
}

export async function changeResourceSupplier(
  resource: Resource,
  values: ResourceSupplierValues,
): Promise<SaveResult<keyof ResourceSupplierValues>> {
  if (!isRecordId(resource.id)) {
    return saveFailed;
  }

  const { response, error } = await apiClient.PATCH("/api/v1/resources/{id}/", {
    params: { path: { id: Number(resource.id) } },
    body: { ...supplierToApi(values), is_stockable: resource.isStockable },
  });

  return saveOutcome(response, error, (errors) =>
    errors.supplier === undefined ? {} : { supplier: errors.supplier },
  );
}

export async function changeResourceQuantity(
  id: string,
  type: ResourceChangeType,
  values: ResourceChangeValues,
): Promise<SaveResult<keyof ResourceChangeValues>> {
  if (!isRecordId(id)) {
    return saveFailed;
  }

  const request = {
    params: { path: { id: Number(id) } },
    body: resourceChangeToApi(values),
  };
  const { response, error } =
    type === "increase"
      ? await apiClient.POST("/api/v1/resources/{id}/increase/", request)
      : await apiClient.POST("/api/v1/resources/{id}/decrease/", request);

  return saveOutcome(response, error, resourceChangeErrorsFromApi);
}

export async function getResourceHistory(
  resourceId: string,
  page: number,
): Promise<Page<ResourceChange>> {
  if (!isRecordId(resourceId)) {
    return notFound();
  }

  const result = await apiClient.GET("/api/v1/resource-history/", {
    params: { query: { resource: Number(resourceId), ordering: "-created_at", page } },
  });

  return toPage(unwrap(result), page, resourceChangeFromApi);
}
