import { describe, expect, it } from "vitest";
import { isJobFilter, isJobTitle, isPaidPerGram, jobChoices, matchesJob } from "./employeeJobs";

describe("job titles", () => {
  it("knows the backend's job title codes only", () => {
    expect(isJobTitle("CHF")).toBe(true);
    expect(isJobTitle("Chauffeur")).toBe(false);
  });

  it("keeps the employees of the chosen job title, or all of them", () => {
    expect(matchesJob("CHF", "CHF")).toBe(true);
    expect(matchesJob("CHF", "MOU")).toBe(false);
    expect(matchesJob("CHF", "all")).toBe(true);
    expect(isJobFilter("all")).toBe(true);
    expect(isJobFilter("SAF")).toBe(true);
    expect(isJobFilter("Chauffeur")).toBe(false);
  });

  it("pays only the gold refiners per gram", () => {
    expect(isPaidPerGram("SAF")).toBe(true);
    expect(isPaidPerGram("CHF")).toBe(false);
  });

  it("offers every job to a new employee, and never a move to or from gold refiner", () => {
    expect(jobChoices(undefined)).toContain("SAF");
    expect(jobChoices(true)).toEqual(["SAF"]);
    expect(jobChoices(false)).not.toContain("SAF");
    expect(jobChoices(false)).toContain("CHF");
  });
});
