import { describe, expect, it } from "vitest";
import { canOpen, homeHref, isUserRole, roleOfToken } from "./access";

function token(payload: object): string {
  return `header.${btoa(JSON.stringify(payload)).replace(/=+$/, "")}.signature`;
}

describe("isUserRole", () => {
  it("knows the manager and the supervisor", () => {
    expect(isUserRole("manager")).toBe(true);
    expect(isUserRole("supervisor")).toBe(true);
  });

  it("refuses any other value", () => {
    expect(isUserRole("cashier")).toBe(false);
    expect(isUserRole(null)).toBe(false);
  });
});

describe("roleOfToken", () => {
  it("reads the role stored in the token", () => {
    expect(roleOfToken(token({ exp: 1, role: "supervisor" }))).toBe("supervisor");
  });

  it("gives nothing for a missing or unknown role", () => {
    expect(roleOfToken(token({ exp: 1, role: null }))).toBeUndefined();
    expect(roleOfToken(token({ exp: 1, role: "accountant" }))).toBeUndefined();
    expect(roleOfToken("not-a-token")).toBeUndefined();
  });
});

describe("canOpen", () => {
  it("lets the manager open every page", () => {
    expect(canOpen("manager", "/users")).toBe(true);
    expect(canOpen("manager", "/dashboard")).toBe(true);
    expect(canOpen("manager", "/settings/projects/4")).toBe(true);
  });

  it("lets the supervisor open the operations pages", () => {
    expect(canOpen("supervisor", "/shipments")).toBe(true);
    expect(canOpen("supervisor", "/shipments/projects/2/history")).toBe(true);
    expect(canOpen("supervisor", "/milling/projects/2/machines/7")).toBe(true);
    expect(canOpen("supervisor", "/refining")).toBe(true);
  });

  it("lets the supervisor open their own settings, not the projects", () => {
    expect(canOpen("supervisor", "/settings")).toBe(true);
    expect(canOpen("supervisor", "/settings/profile")).toBe(true);
    expect(canOpen("supervisor", "/settings/language")).toBe(true);
    expect(canOpen("supervisor", "/settings/projects")).toBe(false);
    expect(canOpen("supervisor", "/settings/projects/2")).toBe(false);
  });

  it("keeps the supervisor out of every other page", () => {
    expect(canOpen("supervisor", "/dashboard")).toBe(false);
    expect(canOpen("supervisor", "/customers")).toBe(false);
    expect(canOpen("supervisor", "/users")).toBe(false);
    expect(canOpen("supervisor", "/inventory")).toBe(false);
    expect(canOpen("supervisor", "/inventory/resources/2")).toBe(false);
    expect(canOpen("supervisor", "/")).toBe(false);
  });
});

describe("homeHref", () => {
  it("opens the dashboard for the manager and shipments for the supervisor", () => {
    expect(homeHref("manager")).toBe("/dashboard");
    expect(homeHref("supervisor")).toBe("/shipments");
  });
});
