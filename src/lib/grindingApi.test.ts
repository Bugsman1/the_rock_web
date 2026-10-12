import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { getGrindingOperations, startOperation } from "./grindingApi";

const API = `${window.location.origin}/api/v1`;
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("getGrindingOperations", () => {
  it("reads a project's operations and places them by grinder code", async () => {
    let requested: URL | undefined;
    server.use(
      http.get(`${API}/grinding-operations/`, ({ request }) => {
        requested = new URL(request.url);
        return HttpResponse.json({
          count: 1,
          results: [
            {
              id: 5,
              shipment_number: "SHP-2026-00002",
              customer_name: "sidi",
              grinder_code: "P6-2",
              project_name: "Zouérat 1",
              bags_count: 10,
              start_time: "2026-10-12T15:00:00Z",
              end_time: null,
              operator_name: "med",
              grinding_cost: "150000.00",
              notes: "",
              created_at: "2026-10-12T15:00:00Z",
              updated_at: "2026-10-12T15:00:00Z",
            },
          ],
        });
      }),
    );

    const operations = await getGrindingOperations("6");

    expect(requested?.searchParams.get("project")).toBe("6");
    expect(operations).toMatchObject([
      { id: "5", project: "6", machine: 2, shipmentNumber: "SHP-2026-00002", bags: 10 },
    ]);
  });
});

describe("startOperation", () => {
  it("creates the operation with its cost and moves a waiting shipment to grinding", async () => {
    let created: unknown;
    let shipmentChange: unknown;
    server.use(
      http.post(`${API}/grinding-operations/`, async ({ request }) => {
        created = await request.json();
        return HttpResponse.json({}, { status: 201 });
      }),
      http.patch(`${API}/shipments/2/`, async ({ request }) => {
        shipmentChange = await request.json();
        return HttpResponse.json({});
      }),
    );

    const result = await startOperation(
      {
        shipmentNumber: "SH-2",
        machine: "2",
        bags: 2,
        startDate: "2026-10-08",
        startTime: "08:00",
        operatorId: "4",
        notes: "",
      },
      {
        shipmentId: "2",
        grinderId: "8",
        startedAt: "2026-10-08T08:00:00.000Z",
        shipmentPending: true,
      },
    );

    expect(result).toEqual({ ok: true });
    expect(created).toEqual({
      shipment: 2,
      grinder: 8,
      bags_count: 2,
      start_time: "2026-10-08T08:00:00.000Z",
      operator: 4,
      grinding_cost: "30000",
      notes: "",
    });
    expect(shipmentChange).toEqual({ status: "grinding" });
  });

  it("leaves the shipment's status alone when it is already in grinding", async () => {
    server.use(
      http.post(`${API}/grinding-operations/`, () => HttpResponse.json({}, { status: 201 })),
    );

    const result = await startOperation(
      {
        shipmentNumber: "SH-2",
        machine: "2",
        bags: 1,
        startDate: "2026-10-08",
        startTime: "08:00",
        operatorId: "4",
        notes: "",
      },
      {
        shipmentId: "2",
        grinderId: "8",
        startedAt: "2026-10-08T08:00:00.000Z",
        shipmentPending: false,
      },
    );

    expect(result).toEqual({ ok: true });
  });
});
