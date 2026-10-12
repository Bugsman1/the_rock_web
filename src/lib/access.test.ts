import { describe, expect, it } from "vitest";
import { accessFromApi, can, canOpen, homeHref, modules, noAccess, rightsFromApi } from "./access";
import type { Access, Module } from "./access";

function access(viewable: readonly Module[], superuser = false): Access {
  return {
    superuser,
    rights: rightsFromApi(viewable.map((module) => ({ module, can_view: true }))),
  };
}

const everything = access(modules);
const supervisor = access([
  "shipments",
  "grinding",
  "refining",
  "customers",
  "accounts",
  "locations",
]);
const refiner = access(["refining"]);

describe("accessFromApi", () => {
  it("keeps the rights of each module the role has", () => {
    const refiner = accessFromApi({
      id: 4,
      email: "aicha@mills.mr",
      full_name: "Aicha",
      phone: "",
      is_superuser: false,
      role: {
        id: 2,
        name: "Refining operator",
        is_project_scoped: true,
        permissions: [
          { module: "refining", can_view: true, can_add: true },
          { module: "inventory", can_view: false },
        ],
      },
    });

    expect(refiner.superuser).toBe(false);
    expect(refiner.rights.refining).toEqual({ view: true, add: true, edit: false, delete: false });
    expect(refiner.rights.inventory.view).toBe(false);
    expect(refiner.rights.shipments.view).toBe(false);
  });

  it("recognises a superuser", () => {
    expect(
      accessFromApi({
        id: 1,
        email: "admin@mills.mr",
        full_name: "",
        phone: "",
        is_superuser: true,
        role: { id: 1, name: "manager", is_project_scoped: false, permissions: [] },
      }).superuser,
    ).toBe(true);
  });
});

describe("can", () => {
  it("gives only the rights the role was given", () => {
    const viewer = access(["refining"]);

    expect(can(viewer, "refining", "view")).toBe(true);
    expect(can(viewer, "refining", "add")).toBe(false);
    expect(can(viewer, "refining", "delete")).toBe(false);
    expect(can(noAccess, "refining", "view")).toBe(false);
  });

  it("gives a superuser every right", () => {
    expect(can(access([], true), "locations", "delete")).toBe(true);
  });
});

describe("canOpen", () => {
  it("opens a section to a role that can view its module", () => {
    expect(canOpen(refiner, "/refining")).toBe(true);
    expect(canOpen(refiner, "/inventory")).toBe(false);
    expect(canOpen(refiner, "/shipments/projects/3")).toBe(false);
    expect(canOpen(access(["inventory"]), "/inventory/resources/2")).toBe(true);
    expect(canOpen(access(["locations"]), "/settings/projects/2")).toBe(true);
    expect(canOpen(access(["accounts"]), "/users/roles")).toBe(true);
  });

  it("opens a form page only to a role that may add or edit there", () => {
    const viewer = access(["shipments", "locations"]);
    const writer: Access = {
      superuser: false,
      rights: rightsFromApi([
        { module: "shipments", can_view: true, can_add: true },
        { module: "locations", can_view: true, can_edit: true },
      ]),
    };

    expect(canOpen(viewer, "/shipments")).toBe(true);
    expect(canOpen(viewer, "/shipments/new")).toBe(false);
    expect(canOpen(viewer, "/settings/projects/2/edit")).toBe(false);
    expect(canOpen(writer, "/shipments/new")).toBe(true);
    expect(canOpen(writer, "/settings/projects/2/edit")).toBe(true);
    expect(canOpen(writer, "/settings/projects/new")).toBe(false);
  });

  it("opens the settings home, profile and language to everyone", () => {
    expect(canOpen(refiner, "/settings")).toBe(true);
    expect(canOpen(refiner, "/settings/profile")).toBe(true);
    expect(canOpen(refiner, "/settings/language")).toBe(true);
    expect(canOpen(refiner, "/settings/projects")).toBe(false);
  });

  it("keeps the sections still to build for roles that can view everything", () => {
    expect(canOpen(everything, "/dashboard")).toBe(true);
    expect(canOpen(supervisor, "/dashboard")).toBe(false);
    expect(canOpen(supervisor, "/accounting")).toBe(false);
  });

  it("lets a superuser open every page", () => {
    expect(canOpen(access([], true), "/dashboard")).toBe(true);
    expect(canOpen(access([], true), "/inventory")).toBe(true);
  });
});

describe("homeHref", () => {
  it("starts on the first page the user can open", () => {
    expect(homeHref(everything)).toBe("/dashboard");
    expect(homeHref(supervisor)).toBe("/shipments");
    expect(homeHref(refiner)).toBe("/refining");
    expect(homeHref(access([]))).toBe("/settings");
  });
});
