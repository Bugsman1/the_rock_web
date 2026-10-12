import { describe, expect, it } from "vitest";
import { operatorsOfProject, roleIdsFromApi, userFromApi } from "./users";

const roleIds = new Map([
  ["manager", 1],
  ["supervisor", 2],
] as const);

const backendUser = {
  id: 4,
  email: "aicha@mills.mr",
  full_name: "عائشة بنت محمد",
  phone: "+222 22 41 18 30",
  role: 2,
  project: 3,
  is_active: true,
};

describe("roleIdsFromApi", () => {
  it("keeps the id of each role", () => {
    expect(
      roleIdsFromApi([
        { id: 1, name: "manager", permissions: [] },
        { id: 2, name: "supervisor", permissions: [] },
      ]),
    ).toEqual(roleIds);
  });
});

describe("userFromApi", () => {
  it("turns a backend user into ours", () => {
    expect(userFromApi(backendUser, roleIds)).toEqual({
      id: "4",
      name: "عائشة بنت محمد",
      email: "aicha@mills.mr",
      phone: "+222 22 41 18 30",
      role: "supervisor",
      project: "3",
    });
  });

  it("falls back to the email when there is no name", () => {
    expect(userFromApi({ ...backendUser, full_name: "" }, roleIds).name).toBe("aicha@mills.mr");
  });

  it("has no role or project when the backend has none", () => {
    const user = userFromApi({ ...backendUser, role: null, project: null }, roleIds);

    expect(user.role).toBeUndefined();
    expect(user.project).toBeUndefined();
  });
});

describe("operatorsOfProject", () => {
  it("offers the managers and the supervisors of the project", () => {
    const user = (id: string, role: "manager" | "supervisor", project?: string) => ({
      id,
      name: id,
      email: `${id}@mills.mr`,
      phone: "",
      role,
      project,
    });

    expect(
      operatorsOfProject(
        [user("boss", "manager"), user("here", "supervisor", "3"), user("away", "supervisor", "4")],
        "3",
      ),
    ).toEqual([
      { id: "boss", name: "boss" },
      { id: "here", name: "here" },
    ]);
  });
});
