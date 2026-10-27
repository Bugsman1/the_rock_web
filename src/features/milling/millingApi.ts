import { apiClient, saveOutcome } from "@/lib/api/client";
import type { BackendFieldErrors, FieldErrors, SaveResult } from "@/lib/api/client";
import { toDecimal } from "@/lib/format";
import type { IsoTimestamp } from "@/lib/format";
import { machinesFromGrinders } from "@/lib/grinding";
import type { MillingOperation } from "@/lib/grinding";
import { getGrindingOperations } from "@/lib/grindingApi";
import { isInService } from "@/lib/projects";
import { getGrinders, getProjects } from "@/lib/projectsApi";
import { getShipments } from "@/lib/shipmentsApi";
import { millingShipments } from "./milling";
import type { EndMillingValues, MercuryAdditionValues, MercuryValues } from "./milling";

export async function getMillingData() {
  const [projects, grinders, shipments, operations] = await Promise.all([
    getProjects(),
    getGrinders(),
    getShipments(),
    getGrindingOperations(),
  ]);

  return {
    projects: projects.filter(isInService),
    machines: machinesFromGrinders(grinders),
    shipments: millingShipments(shipments),
    operations,
  };
}

function endErrorsFromApi(errors: BackendFieldErrors): FieldErrors<keyof EndMillingValues> {
  return {
    ...(errors.end_time === undefined ? {} : { endTime: errors.end_time }),
  };
}

function mercuryErrorsFromApi(errors: BackendFieldErrors): FieldErrors<keyof MercuryValues> {
  return errors.mercury_quantity === undefined ? {} : { quantity: errors.mercury_quantity };
}

export async function markMercuryAdded(
  operationId: string,
  values: MercuryValues,
): Promise<SaveResult<keyof MercuryValues>> {
  const { response, error } = await apiClient.PATCH("/api/v1/grinding-operations/{id}/", {
    params: { path: { id: Number(operationId) } },
    body: { mercury_added: true, mercury_quantity: toDecimal(values.quantity) },
  });

  return saveOutcome(response, error, mercuryErrorsFromApi);
}

export async function endOperation(
  operation: MillingOperation,
  values: EndMillingValues,
  endedAt: IsoTimestamp,
): Promise<SaveResult<keyof EndMillingValues>> {
  const { response, error } = await apiClient.PATCH("/api/v1/grinding-operations/{id}/", {
    params: { path: { id: Number(operation.id) } },
    body: {
      end_time: endedAt,
      notes: [operation.notes, values.notes].filter((note) => note !== "").join("\n"),
    },
  });

  return saveOutcome(response, error, endErrorsFromApi);
}

function mercuryAdditionErrorsFromApi(
  errors: BackendFieldErrors,
): FieldErrors<keyof MercuryAdditionValues> {
  const quantity = errors.quantity ?? errors.grinding_operation;

  return {
    ...(quantity === undefined ? {} : { quantity }),
    ...(errors.notes === undefined ? {} : { notes: errors.notes }),
  };
}

export async function addMercury(
  operationId: string,
  values: MercuryAdditionValues,
): Promise<SaveResult<keyof MercuryAdditionValues>> {
  const { response, error } = await apiClient.POST("/api/v1/mercury-additions/", {
    body: {
      grinding_operation: Number(operationId),
      quantity: toDecimal(values.quantity),
      notes: values.notes,
    },
  });

  return saveOutcome(response, error, mercuryAdditionErrorsFromApi);
}
