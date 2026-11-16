import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  changeResourceQuantity,
  createResource,
  getResource,
  getResourceHistory,
  getResources,
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
  suppliers: [],
  is_stockable: true,
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
  grinding_operation: null,
  grinding_sequence: null,
  grinder_code: null,
  loss: null,
  note: "Achat",
  created_by_name: "Sidi",
  created_at: "2026-10-12T11:00:00Z",
};

describe("getResource", () => {
  it("returns the resource", async () => {
    server.use(http.get(`${API}/resources/2/`, () => HttpResponse.json(mercury)));

    expect((await getResource("2"))?.kind).toBe("mercury");
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
        name: "Mercure",
        initialQuantity: 10,
        supplier: "",
        initialPrice: Number.NaN,
      }),
    ).toEqual({ ok: true, id: "2" });
    expect(body).toEqual({
      project: 3,
      name: "Mercure",
      initial_quantity: "10.000",
      is_refining_material: true,
      is_stockable: true,
    });
  });

  it("shows a name the project already has on the name field", async () => {
    server.use(
      http.post(`${API}/resources/`, () =>
        HttpResponse.json({ name: ["Existe déjà."] }, { status: 400 }),
      ),
    );

    expect(
      await createResource({
        project: "3",
        name: "Mercure",
        initialQuantity: 10,
        supplier: "",
        initialPrice: Number.NaN,
      }),
    ).toEqual({
      ok: false,
      fieldErrors: { name: "Existe déjà." },
      failed: false,
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
          grindingSequence: undefined,
          loss: undefined,
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
  it("asks for the resources by name and keeps every one of them", async () => {
    let requested: URL | undefined;
    server.use(
      http.get(`${API}/resources/`, ({ request }) => {
        requested = new URL(request.url);
        return HttpResponse.json({
          count: 2,
          results: [{ ...mercury, id: 4, name: "Chaux" }, mercury],
        });
      }),
    );

    const resources = await getResources();

    expect(requested?.searchParams.get("ordering")).toBe("name");
    expect(resources.map((resource) => [resource.name, resource.kind])).toEqual([
      ["Chaux", undefined],
      ["Mercure", "mercury"],
    ]);
  });
});

const byHand = { fromSupplier: false, supplier: "", price: Number.NaN };

describe("changeResourceQuantity", () => {
  it("records an increase received from a supplier as its delivery, once per key", async () => {
    let body: unknown;
    let key: string | null = null;
    server.use(
      http.post(`${API}/supplier-deliveries/`, async ({ request }) => {
        body = await request.json();
        key = request.headers.get("Idempotency-Key");
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    expect(
      await changeResourceQuantity(
        "2",
        "increase",
        { quantity: 2, note: "", fromSupplier: true, supplier: "5", price: 300 },
        "key-1",
      ),
    ).toEqual({ ok: true });
    expect(body).toEqual({ supplier: 5, resource: 2, quantity: "2.000", price: "300", notes: "" });
    expect(key).toBe("key-1");
  });

  it("puts a supplier that does not supply the resource on the supplier", async () => {
    server.use(
      http.post(`${API}/supplier-deliveries/`, () =>
        HttpResponse.json({ resource: ["Ne fournit pas cette ressource."] }, { status: 400 }),
      ),
    );

    expect(
      await changeResourceQuantity(
        "2",
        "increase",
        { quantity: 2, note: "", fromSupplier: true, supplier: "5", price: 300 },
        "key-1",
      ),
    ).toEqual({
      ok: false,
      fieldErrors: { supplier: "Ne fournit pas cette ressource." },
      failed: false,
    });
  });

  it("increases a resource", async () => {
    let body: unknown;
    server.use(
      http.post(`${API}/resources/2/increase/`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(change, { status: 201 });
      }),
    );

    expect(
      await changeResourceQuantity(
        "2",
        "increase",
        { ...byHand, quantity: 2, note: "Achat" },
        "key",
      ),
    ).toEqual({
      ok: true,
    });
    expect(body).toEqual({ quantity: "2.000", note: "Achat" });
  });

  it("decreases a resource", async () => {
    let body: unknown;
    server.use(
      http.post(`${API}/resources/2/decrease/`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(change, { status: 201 });
      }),
    );

    expect(
      await changeResourceQuantity("2", "decrease", { ...byHand, quantity: 1.5, note: "" }, "key"),
    ).toEqual({ ok: true });
    expect(body).toEqual({ quantity: "1.500", note: "" });
  });

  it("shows the quantity left when a decrease is too large", async () => {
    server.use(
      http.post(`${API}/resources/2/decrease/`, () =>
        HttpResponse.json({ quantity: ["Il ne reste que 8.5."] }, { status: 400 }),
      ),
    );

    expect(
      await changeResourceQuantity("2", "decrease", { ...byHand, quantity: 9, note: "" }, "key"),
    ).toEqual({
      ok: false,
      fieldErrors: { quantity: "Il ne reste que 8.5." },
      failed: false,
    });
  });
});
