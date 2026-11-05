import type { ApiSchema } from "@/lib/api/client";

export const jobTitles = [
  "ADM",
  "CHF",
  "ENG",
  "MOU",
  "MIN",
  "MEC",
  "SOU",
  "TEC",
  "SAF",
] as const satisfies readonly ApiSchema<"Employee">["job_title"][];

export type JobTitle = (typeof jobTitles)[number];

export function isJobTitle(value: string): value is JobTitle {
  return jobTitles.some((title) => title === value);
}

export type JobFilter = JobTitle | "all";

export function isJobFilter(value: string): value is JobFilter {
  return value === "all" || isJobTitle(value);
}

export function matchesJob(job: JobTitle, filter: JobFilter): boolean {
  return filter === "all" || job === filter;
}
