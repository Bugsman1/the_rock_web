import { apiClient, saveOutcome, unwrap } from "@/lib/api/client";
import type { SaveResult } from "@/lib/api/client";
import type { ProjectId } from "@/lib/projects";
import {
  refinerFromApi,
  refiningErrorsFromApi,
  refiningSummaryFromApi,
  refiningToApi,
  refiningUpdateToApi,
} from "./refining";
import type { Refiner, RefiningField, RefiningTarget, RefiningValues } from "./refining";

export async function getRefiningSummary() {
  return refiningSummaryFromApi(
    unwrap(await apiClient.GET("/api/v1/refining-operations/summary/")),
  );
}

export async function getRefiners(project: ProjectId): Promise<readonly Refiner[]> {
  const result = await apiClient.GET("/api/v1/refiners/", {
    params: { query: { project: Number(project) } },
  });

  return unwrap(result).map(refinerFromApi);
}

export async function createRefiningOperation(
  values: RefiningValues,
  target: RefiningTarget,
): Promise<SaveResult<RefiningField>> {
  const { response, error } = await apiClient.POST("/api/v1/refining-operations/", {
    body: refiningToApi(values, target),
  });

  return saveOutcome(response, error, refiningErrorsFromApi);
}

export async function updateRefiningOperation(
  refiningId: string,
  values: RefiningValues,
): Promise<SaveResult<RefiningField>> {
  const { response, error } = await apiClient.PATCH("/api/v1/refining-operations/{id}/", {
    params: { path: { id: Number(refiningId) } },
    body: refiningUpdateToApi(values),
  });

  return saveOutcome(response, error, refiningErrorsFromApi);
}
