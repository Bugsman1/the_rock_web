import { apiClient, saveOutcome } from "@/lib/api/client";
import type { SaveResult } from "@/lib/api/client";
import { getGrindingOperations } from "@/lib/grindingApi";
import type { Project, ProjectId } from "@/lib/projects";
import { countRefinings } from "@/lib/refiningApi";
import {
  queueOfProject,
  refiningErrorsFromApi,
  refiningSummary,
  refiningToApi,
  refiningUpdateToApi,
  totalCounts,
} from "./refining";
import type { RefiningCounts, RefiningField, RefiningTarget, RefiningValues } from "./refining";

async function projectCounts(project: ProjectId, today: string): Promise<RefiningCounts> {
  const [refined, refinedToday] = await Promise.all([
    countRefinings(project),
    countRefinings(project, today),
  ]);

  return { refined, refinedToday };
}

export async function getRefiningOverview(projects: readonly Project[], today: string) {
  const [queue, counted] = await Promise.all([
    getGrindingOperations({ running: false, refined: false }),
    Promise.all(
      projects.map(async (project) => ({
        project,
        counts: await projectCounts(project.id, today),
      })),
    ),
  ]);

  return {
    total: refiningSummary(queue, totalCounts(counted.map(({ counts }) => counts))),
    projects: counted.map(({ project, counts }) => ({
      project,
      summary: refiningSummary(queueOfProject(queue, project.id), counts),
    })),
  };
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
