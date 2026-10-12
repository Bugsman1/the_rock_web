import { z } from "zod";
import type { ApiSchema, BackendFieldErrors, FieldErrors } from "./api/client";

export const siteKeys = ["zouerat", "sfariyat"] as const;

export type SiteKey = (typeof siteKeys)[number];

export const activityStatuses = ["active", "maintenance", "inactive"] as const;

type ActivityStatus = (typeof activityStatuses)[number];

export type ProjectId = string;

export type Project = {
  id: ProjectId;
  name: string;
  site: SiteKey;
  status: ActivityStatus;
};

export type Grinder = {
  id: string;
  project: ProjectId;
  number: number;
  status: ActivityStatus;
};

const RECORD_ID = /^\d+$/;

export function isRecordId(value: string): boolean {
  return RECORD_ID.test(value);
}

export function isSiteKey(value: string): value is SiteKey {
  return siteKeys.some((key) => key === value);
}

export function isInService(item: { status: ActivityStatus }): boolean {
  return item.status !== "inactive";
}

export function findProject(projects: readonly Project[], id: ProjectId): Project | undefined {
  return projects.find((project) => project.id === id);
}

export function grindersOfProject(
  grinders: readonly Grinder[],
  project: ProjectId,
): readonly Grinder[] {
  return grinders
    .filter((grinder) => grinder.project === project)
    .sort((a, b) => a.number - b.number);
}

const PROJECT_NAME_MAX_LENGTH = 100;

export const GRINDER_NUMBER_MAX = 9999;

export function createProjectSchema(messages: { required: string }) {
  return z.object({
    name: z.string().trim().min(1, messages.required).max(PROJECT_NAME_MAX_LENGTH),
    site: z.enum(siteKeys),
    status: z.enum(activityStatuses),
  });
}

export type ProjectValues = z.infer<ReturnType<typeof createProjectSchema>>;

export function createGrinderSchema(messages: { numberInvalid: string }) {
  return z.object({
    number: z
      .number({ error: messages.numberInvalid })
      .int(messages.numberInvalid)
      .min(1, messages.numberInvalid)
      .max(GRINDER_NUMBER_MAX, messages.numberInvalid),
    status: z.enum(activityStatuses),
  });
}

export type GrinderValues = z.infer<ReturnType<typeof createGrinderSchema>>;

type ApiProject = ApiSchema<"Project">;
type ApiGrinder = ApiSchema<"Grinder">;

const projectFields: readonly (keyof ProjectValues)[] = ["name", "site", "status"];

const grinderFields: readonly (keyof GrinderValues)[] = ["number", "status"];

export function isProjectField(value: string): value is keyof ProjectValues {
  return projectFields.some((field) => field === value);
}

export function isGrinderField(value: string): value is keyof GrinderValues {
  return grinderFields.some((field) => field === value);
}

export function projectFromApi(project: ApiProject): Project {
  return {
    id: String(project.id),
    name: project.name,
    site: project.site,
    status: project.status ?? "active",
  };
}

export function projectToApi({ name, site, status }: ProjectValues) {
  return { name: name.trim(), site, status };
}

export function projectErrorsFromApi(errors: BackendFieldErrors): FieldErrors<keyof ProjectValues> {
  return {
    ...(errors.name === undefined ? {} : { name: errors.name }),
    ...(errors.site === undefined ? {} : { site: errors.site }),
    ...(errors.status === undefined ? {} : { status: errors.status }),
  };
}

const GRINDER_CODE = /^P(\d+)-(\d+)$/;

export function grinderCode(project: ProjectId, number: number): string {
  return `P${project}-${number}`;
}

export function parseGrinderCode(code: string): { project: ProjectId; number: number } | undefined {
  const [, project, number] = GRINDER_CODE.exec(code) ?? [];

  return project === undefined || number === undefined
    ? undefined
    : { project, number: Number(number) };
}

export function grinderFromApi(grinder: ApiGrinder): readonly Grinder[] {
  const parsed = parseGrinderCode(grinder.code);

  return parsed?.project === String(grinder.project)
    ? [
        {
          id: String(grinder.id),
          project: parsed.project,
          number: parsed.number,
          status: grinder.status ?? "active",
        },
      ]
    : [];
}

export function grinderToApi({ number, status }: GrinderValues, project: ProjectId) {
  return {
    project: Number(project),
    code: grinderCode(project, number),
    status,
  };
}

export function grinderErrorsFromApi(errors: BackendFieldErrors): FieldErrors<keyof GrinderValues> {
  return {
    ...(errors.code === undefined ? {} : { number: errors.code }),
    ...(errors.status === undefined ? {} : { status: errors.status }),
  };
}
