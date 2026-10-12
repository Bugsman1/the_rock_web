import { describe, expect, it } from "vitest";
import { navGroupsFor, sectionHrefs } from "./navigation";

describe("navGroupsFor", () => {
  it("gives the manager every group", () => {
    expect(navGroupsFor("manager").map((group) => group.key)).toEqual([
      null,
      "operations",
      "accounts",
      "resources",
      "management",
    ]);
  });

  it("gives the supervisor only the operations", () => {
    const groups = navGroupsFor("supervisor");

    expect(groups.map((group) => group.key)).toEqual(["operations"]);
    expect(groups[0]?.items.map((item) => item.key)).toEqual(["shipments", "milling", "refining"]);
  });
});

describe("sectionHrefs", () => {
  it("lists the page of every menu entry once", () => {
    expect(sectionHrefs).toContain("/dashboard");
    expect(sectionHrefs).toContain("/audit-log");
    expect(new Set(sectionHrefs).size).toBe(sectionHrefs.length);
  });
});
