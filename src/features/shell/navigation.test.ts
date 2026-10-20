import { describe, expect, it } from "vitest";
import { modules, rightsFromApi } from "@/lib/access";
import type { Access, Module } from "@/lib/access";
import { navGroupsFor, sectionHrefs } from "./navigation";

function viewing(viewable: readonly Module[]): Access {
  return {
    superuser: false,
    rights: rightsFromApi(viewable.map((module) => ({ module, can_view: true }))),
  };
}

describe("navGroupsFor", () => {
  it("gives a role that can view everything every group", () => {
    expect(navGroupsFor(viewing(modules)).map((group) => group.key)).toEqual([
      null,
      "operations",
      "accounts",
      "resources",
      "management",
    ]);
  });

  it("gives a role only the sections it can view", () => {
    const groups = navGroupsFor(viewing(["grinding", "refining"]));

    expect(groups.map((group) => group.key)).toEqual(["operations"]);
    expect(groups[0]?.items.map((item) => item.key)).toEqual(["milling", "refining"]);
  });

  it("opens the settlements to a role that can view shipments", () => {
    const groups = navGroupsFor(viewing(["shipments"]));

    expect(groups.map((group) => group.key)).toEqual(["operations", "accounts"]);
    expect(groups[1]?.items.map((item) => item.key)).toEqual(["settlement"]);
  });
});

describe("sectionHrefs", () => {
  it("lists the page of every menu entry once", () => {
    expect(sectionHrefs).toContain("/dashboard");
    expect(sectionHrefs).toContain("/audit-log");
    expect(new Set(sectionHrefs).size).toBe(sectionHrefs.length);
  });
});
