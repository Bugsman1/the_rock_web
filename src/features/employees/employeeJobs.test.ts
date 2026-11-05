import { describe, expect, it } from "vitest";
import { isJobFilter, isJobTitle, matchesJob } from "./employeeJobs";

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
});
