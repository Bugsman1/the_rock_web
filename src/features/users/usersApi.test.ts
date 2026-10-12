import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Role } from "@/lib/users";
import {
  createRole,
  createUser,
  deleteRole,
  getUser,
  getUserPage,
  updateRole,
  updateUser,
} from "./usersApi";
import { newRoleValues } from "./users";

const API = `${window.location.origin}/api/v1`;
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const roles = http.get(`${API}/roles/`, () =>
  HttpResponse.json({
    count: 2,
    results: [
      { id: 1, name: "manager", is_project_scoped: false, users_count: 1, permissions: [] },
      { id: 2, name: "supervisor", is_project_scoped: true, users_count: 1, permissions: [] },
    ],
  }),
);

const manager: Role = {
  id: "1",
  name: "manager",
  projectScoped: false,
};

const supervisor: Role = { ...manager, id: "2", name: "supervisor", projectScoped: true };

const knownRoles = [manager, supervisor];

const aicha = {
  id: 4,
  email: "aicha@mills.mr",
  full_name: "Aicha",
  phone: "+222 22 41 18 30",
  role: 2,
  project: 3,
  is_active: true,
};

const values = {
  name: "Sidi Salem",
  email: "sidi@mills.mr",
  phone: "46109325",
  role: "2",
  password: "secret123",
  project: "3",
};

describe("getUserPage", () => {
  it("lists the active users of the page with their role", async () => {
    let requested: URL | undefined;
    server.use(
      roles,
      http.get(`${API}/users/`, ({ request }) => {
        requested = new URL(request.url);
        return HttpResponse.json({ count: 1, results: [aicha] });
      }),
    );

    const page = await getUserPage(2);

    expect(page.items).toEqual([
      {
        id: "4",
        name: "Aicha",
        email: "aicha@mills.mr",
        phone: "+222 22 41 18 30",
        role: supervisor,
        project: "3",
      },
    ]);
    expect(requested?.searchParams.get("is_active")).toBe("true");
    expect(requested?.searchParams.get("page")).toBe("2");
  });
});

describe("getUser", () => {
  it("returns nothing for an unknown or malformed id", async () => {
    server.use(
      roles,
      http.get(`${API}/users/9/`, () => new HttpResponse(null, { status: 404 })),
    );

    expect(await getUser("9")).toBeUndefined();
    expect(await getUser("../1")).toBeUndefined();
  });
});

describe("createUser", () => {
  it("sends the new user with the role and project ids", async () => {
    let body: unknown;
    server.use(
      http.post(`${API}/users/`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    expect(await createUser(values, knownRoles)).toEqual({ ok: true });
    expect(body).toEqual({
      full_name: "Sidi Salem",
      email: "sidi@mills.mr",
      phone: "+222 46 10 93 25",
      role: 2,
      project: 3,
      password: "secret123",
    });
  });

  it("shows the backend field errors on our fields", async () => {
    server.use(
      http.post(`${API}/users/`, () =>
        HttpResponse.json({ email: ["Existe déjà."] }, { status: 400 }),
      ),
    );

    expect(await createUser(values, knownRoles)).toEqual({
      ok: false,
      fieldErrors: { email: "Existe déjà." },
      failed: false,
    });
  });
});

describe("updateUser", () => {
  it("keeps the current password and sends no project for a role on every project", async () => {
    let body: unknown;
    server.use(
      http.patch(`${API}/users/4/`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({});
      }),
    );

    expect(await updateUser("4", { ...values, role: "1", password: "" }, knownRoles)).toEqual({
      ok: true,
    });
    expect(body).toEqual({
      full_name: "Sidi Salem",
      email: "sidi@mills.mr",
      phone: "+222 46 10 93 25",
      role: 1,
      project: null,
    });
  });

  it("refuses an id that is not a number without calling the backend", async () => {
    expect(await updateUser("../1", values, knownRoles)).toEqual({
      ok: false,
      fieldErrors: {},
      failed: true,
    });
  });
});

describe("createRole", () => {
  it("sends the name, the project scope and the granted sections", async () => {
    let body: unknown;
    server.use(
      http.post(`${API}/roles/`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    expect(await createRole({ ...newRoleValues(), name: "Contrôleur" })).toEqual({ ok: true });
    expect(body).toEqual({ name: "Contrôleur", is_project_scoped: false, permissions: [] });
  });

  it("shows a taken name on the name field", async () => {
    server.use(
      http.post(`${API}/roles/`, () =>
        HttpResponse.json({ name: ["Ce nom existe déjà."] }, { status: 400 }),
      ),
    );

    expect(await createRole({ ...newRoleValues(), name: "manager" })).toEqual({
      ok: false,
      fieldErrors: { name: "Ce nom existe déjà." },
      failed: false,
    });
  });
});

describe("updateRole", () => {
  it("refuses an id that is not a number without calling the backend", async () => {
    expect(await updateRole("../1", newRoleValues())).toEqual({
      ok: false,
      fieldErrors: {},
      failed: true,
    });
  });
});

describe("deleteRole", () => {
  it("deletes the role", async () => {
    server.use(http.delete(`${API}/roles/5/`, () => new HttpResponse(null, { status: 204 })));

    expect(await deleteRole("5")).toEqual({ ok: true });
  });

  it("gives the backend reason when the role is still in use", async () => {
    server.use(
      http.delete(`${API}/roles/5/`, () =>
        HttpResponse.json({ role: "Ce rôle est encore utilisé." }, { status: 400 }),
      ),
    );

    expect(await deleteRole("5")).toEqual({ ok: false, reason: "Ce rôle est encore utilisé." });
  });
});
