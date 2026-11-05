import { apiClient, unwrap } from "./api/client";
import { fetchAllPages, MAX_PAGE_SIZE, PAGE_SIZE } from "./api/pagination";
import type { ProjectId } from "./projects";
import { refiningOperationFromApi } from "./refining";
import type { RefiningOperation } from "./refining";

export type RefiningOperationsFilter = {
  project?: ProjectId;
  customer?: string;
  goldWeighed?: boolean;
};

export async function getRefiningOperations({
  project,
  customer,
  goldWeighed,
}: RefiningOperationsFilter = {}): Promise<readonly RefiningOperation[]> {
  const operations = await fetchAllPages(async (page) =>
    unwrap(
      await apiClient.GET("/api/v1/refining-operations/", {
        params: {
          query: {
            ordering: "-refining_date",
            page,
            page_size: MAX_PAGE_SIZE,
            ...(project === undefined ? {} : { project: Number(project) }),
            ...(customer === undefined ? {} : { shipment__customer: Number(customer) }),
            ...(goldWeighed === undefined ? {} : { gold_weighed: goldWeighed }),
          },
        },
      }),
    ),
  );

  return operations.map(refiningOperationFromApi);
}

export async function countRefinings(project: ProjectId, day?: string): Promise<number> {
  const result = unwrap(
    await apiClient.GET("/api/v1/refining-operations/", {
      params: {
        query: {
          page_size: 1,
          project: Number(project),
          ...(day === undefined
            ? {}
            : { refining_date__date__gte: day, refining_date__date__lte: day }),
        },
      },
    }),
  );

  return result.count;
}

export type RefiningListFilter = {
  project: ProjectId;
  search: string;
  goldWeighed?: boolean;
  grinder?: string;
  customer?: string;
  refinedFrom?: string;
  refinedTo?: string;
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
