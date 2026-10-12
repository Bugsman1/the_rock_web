import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createGrinder,
  createProject,
  getGrinders,
  getProjects,
  requireProject,
  updateGrinder,
  updateProject,
} from "./projectsApi";

const API = `${window.location.origin}/api/v1`;
const NUMBER_TAKEN = "number taken";
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const stamps = {
  is_active: true,
  created_at: "2026-10-01T08:00:00Z",
  updated_at: "2026-10-01T08:00:00Z",
};

function grinders(list: { id: number; code: string }[]) {
  return http.get(`${API}/grinders/`, () =>
    HttpResponse.json({
      count: list.length,
      results: list.map((grinder) => ({ ...grinder, project: 3, status: "active", ...stamps })),
    }),
  );
}

describe("getProjects", () => {
  it("lists the projects by name", async () => {
    let requested: URL | undefined;
    server.use(
      http.get(`${API}/projects/`, ({ request }) => {
        requested = new URL(request.url);
        return HttpResponse.json({
          count: 1,
          results: [{ id: 3, name: "Zouérat 1", site: "zouerat", status: "active", ...stamps }],
        });
      }),
    );

    expect(await getProjects()).toEqual([
      { id: "3", name: "Zouérat 1", site: "zouerat", status: "active" },
    ]);
    expect(requested?.searchParams.get("ordering")).toBe("name");
  });
});

describe("requireProject", () => {
  it("fails as not found for an unknown or malformed id", async () => {
    server.use(http.get(`${API}/projects/9/`, () => new HttpResponse(null, { status: 404 })));

    await expect(requireProject("9")).rejects.toMatchObject({ status: 404 });
    await expect(requireProject("../users")).rejects.toMatchObject({ status: 404 });
  });
});

describe("getGrinders", () => {
  it("asks for one project's grinders and keeps ours only", async () => {
    let requested: URL | undefined;
    server.use(
      http.get(`${API}/grinders/`, ({ request }) => {
        requested = new URL(request.url);
        return HttpResponse.json({
          count: 2,
          results: [
            { id: 1, code: "P3-2", project: 3, status: "active", ...stamps },
            { id: 2, code: "OTHER", project: 3, status: "active", ...stamps },
          ],
        });
      }),
    );

    expect(await getGrinders("3")).toEqual([
      { id: "1", project: "3", number: 2, status: "active" },
    ]);
    expect(requested?.searchParams.get("project")).toBe("3");
  });
});

describe("createProject and updateProject", () => {
  it("sends the project", async () => {
    let body: unknown;
    server.use(
      http.post(`${API}/projects/`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    expect(await createProject({ name: "Zouérat 2", site: "zouerat", status: "active" })).toEqual({
      ok: true,
    });
    expect(body).toEqual({ name: "Zouérat 2", site: "zouerat", status: "active" });
  });

  it("refuses a malformed id without calling the backend", async () => {
    expect(
      await updateProject("../1", { name: "Zouérat 2", site: "zouerat", status: "active" }),
    ).toEqual({ ok: false, fieldErrors: {}, failed: true });
  });
});

describe("createGrinder and updateGrinder", () => {
  it("sends the machine with a code unique to the project", async () => {
    let body: unknown;
    server.use(
      grinders([{ id: 1, code: "P3-1" }]),
      http.post(`${API}/grinders/`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    expect(await createGrinder("3", { number: 2, status: "active" }, NUMBER_TAKEN)).toEqual({
      ok: true,
    });
    expect(body).toEqual({ project: 3, code: "P3-2", status: "active" });
  });

  it("refuses a number another machine of the project already has", async () => {
    server.use(grinders([{ id: 1, code: "P3-2" }]));

    expect(await createGrinder("3", { number: 2, status: "active" }, NUMBER_TAKEN)).toEqual({
      ok: false,
      fieldErrors: { number: NUMBER_TAKEN },
      failed: false,
    });
  });

  it("lets a machine keep its own number", async () => {
    server.use(
      grinders([{ id: 1, code: "P3-2" }]),
      http.patch(`${API}/grinders/1/`, () => HttpResponse.json({})),
    );

    expect(
      await updateGrinder("3", "1", { number: 2, status: "maintenance" }, NUMBER_TAKEN),
    ).toEqual({ ok: true });
  });
});
