import { apiClient, saveOutcome, tryLoad } from "@/lib/api/client";
import type { SaveResult } from "@/lib/api/client";
import { getGrindingOperations } from "@/lib/grindingApi";
import { getProjects } from "@/lib/projectsApi";
import { getRefiningOperations } from "@/lib/refiningApi";
import { refiningErrorsFromApi, refiningToApi } from "./refining";
import type { RefiningTarget, RefiningValues } from "./refining";

export async function getRefiningData() {
  const [projects, grindings, operations] = await Promise.all([
    getProjects(),
    getGrindingOperations(),
    tryLoad(() => getRefiningOperations()),
  ]);

  return { projects, grindings, operations };
}

export async function createRefiningOperation(
  values: RefiningValues,
  target: RefiningTarget,
): Promise<SaveResult<keyof RefiningValues>> {
  const { response, error } = await apiClient.POST("/api/v1/refining-operations/", {
    body: refiningToApi(values, target),
  });

  return saveOutcome(response, error, refiningErrorsFromApi);
}
