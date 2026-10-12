import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { getOperators, roleFromApi, roleLabel, userFromApi } from "./users";
import type { Role } from "./users";

const supervisor: Role = {
  id: "2",
  name: "supervisor",
  projectScoped: true,
};

const refiner: Role = {
  id: "5",
  name: "Raffineur",
  projectScoped: false,
};

const backendUser = {
  id: 4,
  email: "aicha@mills.mr",
  full_name: "عائشة بنت محمد",
  phone: "+222 22 41 18 30",
  role: 2,
  project: 3,
  is_active: true,
};

const API = `${window.location.origin}/api/v1`;
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("roleFromApi", () => {
  it("keeps the name and the project scope of the role", () => {
    expect(
      roleFromApi({
        id: 2,
        name: "supervisor",
        is_project_scoped: true,
        users_count: 1,
        permissions: [
          { module: "grinding", can_view: true },
          { module: "refining", can_view: true, can_add: true },
          { module: "inventory", can_view: false },
        ],
      }),
    ).toEqual(supervisor);
  });
});

describe("roleLabel", () => {
  it("translates the built-in roles and keeps custom names", () => {
    const builtIn = (name: string) => `[${name}]`;

    expect(roleLabel("manager", builtIn)).toBe("[manager]");
    expect(roleLabel("Raffineur", builtIn)).toBe("Raffineur");
  });
});

describe("userFromApi", () => {
  it("turns a backend user into ours", () => {
    expect(userFromApi(backendUser, [supervisor, refiner])).toEqual({
      id: "4",
      name: "عائشة بنت محمد",
      email: "aicha@mills.mr",
      phone: "+222 22 41 18 30",
      role: supervisor,
      project: "3",
    });
  });

  it("falls back to the email when there is no name", () => {
    expect(userFromApi({ ...backendUser, full_name: "" }, [supervisor]).name).toBe(
      "aicha@mills.mr",
    );
  });

  it("has no role or project when the backend has none", () => {
    const user = userFromApi({ ...backendUser, role: null, project: null }, [supervisor]);

    expect(user.role).toBeUndefined();
    expect(user.project).toBeUndefined();
  });
});

describe("getOperators", () => {
  it("asks the backend for the operators of the module on the project", async () => {
    let requested: URL | undefined;
    server.use(
      http.get(`${API}/operators/`, ({ request }) => {
        requested = new URL(request.url);
        return HttpResponse.json([{ id: 4, name: "Aicha" }]);
      }),
    );

    expect(await getOperators("3", "refining")).toEqual([{ id: "4", name: "Aicha" }]);
    expect(requested?.searchParams.get("module")).toBe("refining");
    expect(requested?.searchParams.get("project")).toBe("3");
  });
});
