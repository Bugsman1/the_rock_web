import { apiClient, saveOutcome } from "@/lib/api/client";
import type { SaveResult } from "@/lib/api/client";
import { getGrindingOperations } from "@/lib/grindingApi";
import { getProjects } from "@/lib/projectsApi";
import { getRefiningOperations } from "@/lib/refiningApi";
import { refiningErrorsFromApi, refiningToApi, refiningUpdateToApi } from "./refining";
import type { RefiningField, RefiningTarget, RefiningValues } from "./refining";

export async function getRefiningData() {
  const [projects, grindings, refinings] = await Promise.all([
    getProjects(),
    getGrindingOperations(),
    getRefiningOperations(),
  ]);

  return { projects, grindings, refinings };
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
