import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  changeResourceQuantity,
  createResource,
  getResource,
  getResourceHistory,
  getResources,
  renameResource,
} from "./resourcesApi";

const API = `${window.location.origin}/api/v1`;
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const mercury = {
  id: 2,
  project: 3,
  project_name: "Zouérat 1",
  name: "Mercure",
  initial_quantity: "10.000",
  current_quantity: "8.500",
  created_at: "2026-10-12T08:00:00Z",
  updated_at: "2026-10-12T08:00:00Z",
};

const change = {
  id: 11,
  resource: 2,
  resource_name: "Mercure",
  project_name: "Zouérat 1",
  change_type: "increase",
  quantity: "2.000",
  quantity_before: "8.500",
  quantity_after: "10.500",
  refining_operation: null,
  shipment_number: null,
  note: "Achat",
  created_by_name: "Sidi",
  created_at: "2026-10-12T11:00:00Z",
};

describe("getResource", () => {
  it("returns the resource", async () => {
    server.use(http.get(`${API}/resources/2/`, () => HttpResponse.json(mercury)));

    expect((await getResource("2"))?.name).toBe("Mercure");
  });

  it("returns nothing for an unknown or malformed id", async () => {
    server.use(http.get(`${API}/resources/9/`, () => new HttpResponse(null, { status: 404 })));

    expect(await getResource("9")).toBeUndefined();
    expect(await getResource("../users")).toBeUndefined();
  });
});

describe("createResource", () => {
  it("sends the new resource", async () => {
    let body: unknown;
    server.use(
      http.post(`${API}/resources/`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(mercury, { status: 201 });
      }),
    );

    expect(
      await createResource({
        project: "3",
        kind: "mercury",
        name: "",
        initialQuantity: 10,
      }),
    ).toEqual({
      ok: true,
    });
    expect(body).toEqual({
      project: 3,
      name: "mercury",
      initial_quantity: "10.000",
      is_refining_material: true,
    });
  });

  it("shows a name already used in the project on the name field", async () => {
    server.use(
      http.post(`${API}/resources/`, () =>
        HttpResponse.json({ name: ["Existe déjà."] }, { status: 400 }),
      ),
    );

    expect(
      await createResource({
        project: "3",
        kind: "mercury",
        name: "",
        initialQuantity: 10,
      }),
    ).toEqual({
      ok: false,
      fieldErrors: { name: "Existe déjà." },
      failed: false,
    });
  });
});

describe("renameResource", () => {
  it("sends only the new name", async () => {
    let body: unknown;
    server.use(
      http.patch(`${API}/resources/2/`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(mercury);
      }),
    );

    expect(await renameResource("2", "Chaux vive")).toEqual({ ok: true });
    expect(body).toEqual({ name: "Chaux vive" });
  });

  it("refuses an id that is not a number without calling the backend", async () => {
    expect(await renameResource("../users", "Chaux")).toEqual({
      ok: false,
      fieldErrors: {},
      failed: true,
    });
  });
});

describe("getResourceHistory", () => {
  it("asks for one page of a resource's changes, newest first", async () => {
    let requested: URL | undefined;
    server.use(
      http.get(`${API}/resource-history/`, ({ request }) => {
        requested = new URL(request.url);
        return HttpResponse.json({ count: 1, results: [change] });
      }),
    );

    const page = await getResourceHistory("2", 1);

    expect(requested?.searchParams.get("resource")).toBe("2");
    expect(requested?.searchParams.get("ordering")).toBe("-created_at");
    expect(page).toEqual({
      items: [
        {
          id: "11",
          type: "increase",
          quantity: 2,
          quantityBefore: 8.5,
          quantityAfter: 10.5,
          fromRefining: false,
          shipmentNumber: undefined,
          note: "Achat",
          byName: "Sidi",
          at: "2026-10-12T11:00:00Z",
        },
      ],
      total: 1,
      page: 1,
      pageCount: 1,
    });
  });

  it("answers not found for a malformed id", async () => {
    await expect(getResourceHistory("../users", 1)).rejects.toBeInstanceOf(Response);
  });
});

describe("getResources", () => {
  it("asks for the resources by name and maps them", async () => {
    let requested: URL | undefined;
    server.use(
      http.get(`${API}/resources/`, ({ request }) => {
        requested = new URL(request.url);
        return HttpResponse.json({ count: 1, results: [mercury] });
      }),
    );

    const resources = await getResources();

    expect(requested?.searchParams.get("ordering")).toBe("name");
    expect(resources).toEqual([
      {
        id: "2",
        project: "3",
        projectName: "Zouérat 1",
        name: "Mercure",
        initialQuantity: 10,
        currentQuantity: 8.5,
        isRefiningMaterial: false,
      },
    ]);
  });
});

describe("changeResourceQuantity", () => {
  it("increases a resource", async () => {
    let body: unknown;
    server.use(
      http.post(`${API}/resources/2/increase/`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(change, { status: 201 });
      }),
    );

    expect(
      await changeResourceQuantity("2", "increase", {
        quantity: 2,
        note: "Achat",
        refiningOperationId: "",
      }),
    ).toEqual({
      ok: true,
    });
    expect(body).toEqual({ quantity: "2.000", note: "Achat" });
  });

  it("decreases a resource for a refining operation", async () => {
    let body: unknown;
    server.use(
      http.post(`${API}/resources/2/decrease/`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(change, { status: 201 });
      }),
    );

    expect(
      await changeResourceQuantity("2", "decrease", {
        quantity: 1.5,
        note: "",
        refiningOperationId: "5",
      }),
    ).toEqual({ ok: true });
    expect(body).toEqual({ quantity: "1.500", note: "", refining_operation: 5 });
  });

  it("shows the quantity left when a decrease is too large", async () => {
    server.use(
      http.post(`${API}/resources/2/decrease/`, () =>
        HttpResponse.json({ quantity: ["Il ne reste que 8.5."] }, { status: 400 }),
      ),
    );

    expect(
      await changeResourceQuantity("2", "decrease", {
        quantity: 9,
        note: "",
        refiningOperationId: "",
      }),
    ).toEqual({
      ok: false,
      fieldErrors: { quantity: "Il ne reste que 8.5." },
      failed: false,
    });
  });
});
