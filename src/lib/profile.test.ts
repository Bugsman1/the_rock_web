import { describe, expect, it } from "vitest";
import { displayName, profileFromApi } from "./profile";

const me: Parameters<typeof profileFromApi>[0] = {
  id: 4,
  email: "aicha@mills.mr",
  full_name: "Aicha Mint Mohamed",
  phone: "+222 22 41 18 30",
  is_superuser: false,
  role: { id: 2, name: "supervisor", is_project_scoped: true, permissions: [] },
};

describe("displayName", () => {
  it("shows the full name", () => {
    expect(displayName({ full_name: "  Sidi Mohamed ", email: "sidi@mills.mr" })).toBe(
      "Sidi Mohamed",
    );
  });

  it("falls back to the email when no name is set", () => {
    expect(displayName({ full_name: " ", email: "sidi@mills.mr" })).toBe("sidi@mills.mr");
  });
});

describe("profileFromApi", () => {
  it("turns the signed-in user into a profile", () => {
    expect(profileFromApi(me)).toEqual({
      name: "Aicha Mint Mohamed",
      email: "aicha@mills.mr",
      phone: "+222 22 41 18 30",
      roleName: "supervisor",
    });
  });
});
