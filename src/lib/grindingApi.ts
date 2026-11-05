import { apiClient, saveOutcome, unwrap } from "./api/client";
import type { BackendFieldErrors, FieldErrors, SaveResult } from "./api/client";
import { fetchAllPages, MAX_PAGE_SIZE, PAGE_SIZE } from "./api/pagination";
import { todayAsInputValue } from "./datetime";
import { operationFromApi } from "./grinding";
import type { MillingOperation, NewOperationValues } from "./grinding";
import type { IsoTimestamp } from "./format";
import type { ProjectId } from "./projects";

export type GrindingOperationsFilter = {
  project?: ProjectId;
  running?: boolean;
  refined?: boolean;
};

export async function getGrindingOperations({
  project,
  running,
  refined,
}: GrindingOperationsFilter = {}): Promise<readonly MillingOperation[]> {
  const operations = await fetchAllPages(async (page) =>
    unwrap(
      await apiClient.GET("/api/v1/grinding-operations/", {
        params: {
          query: {
            page,
            page_size: MAX_PAGE_SIZE,
            ...(project === undefined ? {} : { project: Number(project) }),
            ...(running === undefined ? {} : { is_running: running }),
            ...(refined === undefined ? {} : { refined }),
          },
        },
      }),
    ),
  );

  return operations.flatMap(operationFromApi);
}

export async function getGrindingsEndedOn(day: string): Promise<readonly MillingOperation[]> {
  const ended: MillingOperation[] = [];
  let page = 1;
  let done = false;

  while (!done) {
    const result = unwrap(
      await apiClient.GET("/api/v1/grinding-operations/", {
        params: { query: { is_running: false, ordering: "-end_time", page, page_size: PAGE_SIZE } },
      }),
    );
    const operations = result.results.flatMap(operationFromApi);
    const ofDay = operations.filter(
      (operation) =>
        operation.endedAt !== undefined && todayAsInputValue(new Date(operation.endedAt)) === day,
    );
    ended.push(...ofDay);
    done = ofDay.length < operations.length || page * PAGE_SIZE >= result.count;
    page += 1;
  }

  return ended;
}

export type GrindingListFilter = {
  project: ProjectId;
  search: string;
  ordering: "-start_time" | "end_time";
  grinder?: string;
  running?: boolean;
  refined?: boolean;
  customer?: string;
  startedFrom?: string;
  startedTo?: string;
};

export type GrindingSlice = {
  operations: readonly MillingOperation[];
  total: number;
};

export async function getGrindingPage(
  filter: GrindingListFilter,
  page: number,
): Promise<GrindingSlice> {
  const result = unwrap(
    await apiClient.GET("/api/v1/grinding-operations/", {
      params: {
        query: {
          ordering: filter.ordering,
          page,
          page_size: PAGE_SIZE,
          project: Number(filter.project),
          ...(filter.search === "" ? {} : { search: filter.search }),
          ...(filter.grinder === undefined ? {} : { grinder: Number(filter.grinder) }),
          ...(filter.running === undefined ? {} : { is_running: filter.running }),
          ...(filter.refined === undefined ? {} : { refined: filter.refined }),
          ...(filter.customer === undefined ? {} : { shipment__customer: Number(filter.customer) }),
          ...(filter.startedFrom === undefined
            ? {}
            : { start_time__date__gte: filter.startedFrom }),
          ...(filter.startedTo === undefined ? {} : { start_time__date__lte: filter.startedTo }),
        },
      },
    }),
  );

  return { operations: result.results.flatMap(operationFromApi), total: result.count };
}

export async function getGrindingOperation(id: string): Promise<MillingOperation | undefined> {
  const result = await apiClient.GET("/api/v1/grinding-operations/{id}/", {
    params: { path: { id: Number(id) } },
  });

  return result.response.status === 404 ? undefined : operationFromApi(unwrap(result))[0];
}

function newOperationErrorsFromApi(
  errors: BackendFieldErrors,
): FieldErrors<keyof NewOperationValues> {
  return {
    ...(errors.shipment === undefined ? {} : { shipmentNumber: errors.shipment }),
    ...(errors.grinder === undefined ? {} : { machine: errors.grinder }),
    ...(errors.bags_count === undefined ? {} : { bags: errors.bags_count }),
    ...(errors.start_time === undefined ? {} : { startTime: errors.start_time }),
    ...(errors.operator === undefined ? {} : { operatorId: errors.operator }),
  };
}

type OperationTarget = {
  shipmentId: string;
  grinderId: string;
  startedAt: IsoTimestamp;
};

function operationToApi(
  values: NewOperationValues,
  { shipmentId, grinderId, startedAt }: OperationTarget,
) {
  return {
    shipment: Number(shipmentId),
    grinder: Number(grinderId),
    bags_count: values.bags,
    start_time: startedAt,
    operator: Number(values.operatorId),
    notes: values.notes,
  };
}

export async function startOperation(
  values: NewOperationValues,
  target: OperationTarget,
): Promise<SaveResult<keyof NewOperationValues>> {
  const { response, error } = await apiClient.POST("/api/v1/grinding-operations/", {
    body: operationToApi(values, target),
  });

  return saveOutcome(response, error, newOperationErrorsFromApi);
}

export async function updateOperation(
  operationId: string,
  values: NewOperationValues,
  target: OperationTarget,
): Promise<SaveResult<keyof NewOperationValues>> {
  const { response, error } = await apiClient.PATCH("/api/v1/grinding-operations/{id}/", {
    params: { path: { id: Number(operationId) } },
    body: operationToApi(values, target),
  });

  return saveOutcome(response, error, newOperationErrorsFromApi);
}
