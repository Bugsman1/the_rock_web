import { apiClient, saveOutcome, unwrap } from "./api/client";
import type { BackendFieldErrors, FieldErrors, SaveResult } from "./api/client";
import { fetchAllPages, MAX_PAGE_SIZE } from "./api/pagination";
import { millingCost, operationFromApi } from "./grinding";
import type { MillingOperation, NewOperationValues } from "./grinding";
import type { IsoTimestamp } from "./format";
import type { ProjectId } from "./projects";
import { setShipmentStatus } from "./shipmentsApi";

export async function getGrindingOperations(
  project?: ProjectId,
): Promise<readonly MillingOperation[]> {
  const operations = await fetchAllPages(async (page) =>
    unwrap(
      await apiClient.GET("/api/v1/grinding-operations/", {
        params: {
          query: {
            page,
            page_size: MAX_PAGE_SIZE,
            ...(project === undefined ? {} : { project: Number(project) }),
          },
        },
      }),
    ),
  );

  return operations.flatMap(operationFromApi);
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
  shipmentPending: boolean;
};

export async function startOperation(
  values: NewOperationValues,
  { shipmentId, grinderId, startedAt, shipmentPending }: OperationTarget,
): Promise<SaveResult<keyof NewOperationValues>> {
  const { response, error } = await apiClient.POST("/api/v1/grinding-operations/", {
    body: {
      shipment: Number(shipmentId),
      grinder: Number(grinderId),
      bags_count: values.bags,
      start_time: startedAt,
      operator: Number(values.operatorId),
      grinding_cost: String(millingCost(values.bags)),
      notes: values.notes,
    },
  });

  const outcome = saveOutcome(response, error, newOperationErrorsFromApi);

  if (outcome.ok && shipmentPending) {
    await setShipmentStatus(shipmentId, "grinding");
  }

  return outcome;
}
