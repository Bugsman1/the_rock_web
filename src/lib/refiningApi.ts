import { apiClient, unwrap } from "./api/client";
import { PAGE_SIZE } from "./api/pagination";
import type { ProjectId } from "./projects";
import { refiningOperationFromApi } from "./refining";
import type { RefiningOperation } from "./refining";

export type RefiningListFilter = {
  project: ProjectId;
  search: string;
  goldWeighed?: boolean;
  grinder?: string;
  customer?: string;
  refinedFrom?: string;
  refinedTo?: string;
  refiner?: string;
};

export type RefiningSlice = {
  refinings: readonly RefiningOperation[];
  total: number;
};

export async function getRefiningPage(
  filter: RefiningListFilter,
  page: number,
): Promise<RefiningSlice> {
  const result = unwrap(
    await apiClient.GET("/api/v1/refining-operations/", {
      params: {
        query: {
          ordering: "-refining_date",
          page,
          page_size: PAGE_SIZE,
          project: Number(filter.project),
          ...(filter.search === "" ? {} : { search: filter.search }),
          ...(filter.goldWeighed === undefined ? {} : { gold_weighed: filter.goldWeighed }),
          ...(filter.grinder === undefined ? {} : { grinder: Number(filter.grinder) }),
          ...(filter.customer === undefined ? {} : { shipment__customer: Number(filter.customer) }),
          ...(filter.refinedFrom === undefined
            ? {}
            : { refining_date__date__gte: filter.refinedFrom }),
          ...(filter.refinedTo === undefined ? {} : { refining_date__date__lte: filter.refinedTo }),
          ...(filter.refiner === undefined ? {} : { refiner: Number(filter.refiner) }),
        },
      },
    }),
  );

  return { refinings: result.results.map(refiningOperationFromApi), total: result.count };
}

export async function getRefiningOperation(id: string): Promise<RefiningOperation | undefined> {
  const result = await apiClient.GET("/api/v1/refining-operations/{id}/", {
    params: { path: { id: Number(id) } },
  });

  return result.response.status === 404 ? undefined : refiningOperationFromApi(unwrap(result));
}
