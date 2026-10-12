import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createUser, getUser, getUserPage, updateUser } from "./usersApi";

const API = `${window.location.origin}/api/v1`;
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const roles = http.get(`${API}/roles/`, () =>
  HttpResponse.json({
    count: 2,
    results: [
      { id: 1, name: "manager", permissions: [] },
      { id: 2, name: "supervisor", permissions: [] },
    ],
  }),
);

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
  role: "supervisor" as const,
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
        role: "supervisor",
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
      roles,
      http.post(`${API}/users/`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    expect(await createUser(values)).toEqual({ ok: true });
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
      roles,
      http.post(`${API}/users/`, () =>
        HttpResponse.json({ email: ["Existe déjà."] }, { status: 400 }),
      ),
    );

    expect(await createUser(values)).toEqual({
      ok: false,
      fieldErrors: { email: "Existe déjà." },
      failed: false,
    });
  });
});

describe("updateUser", () => {
  it("keeps the current password and sends no project for a manager", async () => {
    let body: unknown;
    server.use(
      roles,
      http.patch(`${API}/users/4/`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({});
      }),
    );

    expect(await updateUser("4", { ...values, role: "manager", password: "" })).toEqual({
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
    expect(await updateUser("../1", values)).toEqual({ ok: false, fieldErrors: {}, failed: true });
  });
});
