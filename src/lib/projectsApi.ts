import { apiClient, notFound, saveFailed, saveOutcome, unwrap } from "./api/client";
import type { SaveResult } from "./api/client";
import { MAX_PAGE_SIZE } from "./api/pagination";
import {
  grinderErrorsFromApi,
  grinderFromApi,
  grinderToApi,
  isRecordId,
  projectErrorsFromApi,
  projectFromApi,
  projectToApi,
} from "./projects";
import type { Grinder, GrinderValues, Project, ProjectId, ProjectValues } from "./projects";

export async function getProjects(): Promise<readonly Project[]> {
  const result = await apiClient.GET("/api/v1/projects/", {
    params: { query: { ordering: "name", page_size: MAX_PAGE_SIZE } },
  });

  return unwrap(result).results.map(projectFromApi);
}

export async function requireProject(id: string): Promise<Project> {
  if (!isRecordId(id)) {
    notFound();
  }

  const result = await apiClient.GET("/api/v1/projects/{id}/", {
    params: { path: { id: Number(id) } },
  });

  return result.response.status === 404 ? notFound() : projectFromApi(unwrap(result));
}

export async function getGrinders(project?: ProjectId): Promise<readonly Grinder[]> {
  const result = await apiClient.GET("/api/v1/grinders/", {
    params: {
      query: {
        page_size: MAX_PAGE_SIZE,
        ...(project === undefined ? {} : { project: Number(project) }),
      },
    },
  });

  return unwrap(result).results.flatMap(grinderFromApi);
}

export async function createProject(
  values: ProjectValues,
): Promise<SaveResult<keyof ProjectValues>> {
  const { response, error } = await apiClient.POST("/api/v1/projects/", {
    body: projectToApi(values),
  });

  return saveOutcome(response, error, projectErrorsFromApi);
}

export async function updateProject(
  id: ProjectId,
  values: ProjectValues,
): Promise<SaveResult<keyof ProjectValues>> {
  if (!isRecordId(id)) {
    return saveFailed;
  }

  const { response, error } = await apiClient.PATCH("/api/v1/projects/{id}/", {
    params: { path: { id: Number(id) } },
    body: projectToApi(values),
  });

  return saveOutcome(response, error, projectErrorsFromApi);
}

export async function deleteProject(id: ProjectId): Promise<boolean> {
  if (!isRecordId(id)) {
    return false;
  }

  const { response } = await apiClient.DELETE("/api/v1/projects/{id}/", {
    params: { path: { id: Number(id) } },
  });

  return response.ok;
}

type SaveGrinderResult = SaveResult<keyof GrinderValues>;

async function numberTakenError(
  project: ProjectId,
  values: GrinderValues,
  numberTaken: string,
  exceptId?: string,
): Promise<SaveGrinderResult | undefined> {
  const taken = (await getGrinders(project)).some(
    (grinder) => grinder.number === values.number && grinder.id !== exceptId,
  );

  return taken ? { ok: false, fieldErrors: { number: numberTaken }, failed: false } : undefined;
}

export async function createGrinder(
  project: ProjectId,
  values: GrinderValues,
  numberTaken: string,
): Promise<SaveGrinderResult> {
  if (!isRecordId(project)) {
    return saveFailed;
  }

  const taken = await numberTakenError(project, values, numberTaken);

  if (taken !== undefined) {
    return taken;
  }

  const { response, error } = await apiClient.POST("/api/v1/grinders/", {
    body: grinderToApi(values, project),
  });

  return saveOutcome(response, error, grinderErrorsFromApi);
}

export async function updateGrinder(
  project: ProjectId,
  id: string,
  values: GrinderValues,
  numberTaken: string,
): Promise<SaveGrinderResult> {
  if (!isRecordId(project) || !isRecordId(id)) {
    return saveFailed;
  }

  const taken = await numberTakenError(project, values, numberTaken, id);

  if (taken !== undefined) {
    return taken;
  }

  const { response, error } = await apiClient.PATCH("/api/v1/grinders/{id}/", {
    params: { path: { id: Number(id) } },
    body: grinderToApi(values, project),
  });

  return saveOutcome(response, error, grinderErrorsFromApi);
}
