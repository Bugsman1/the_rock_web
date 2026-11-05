import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  getGrindingOperations,
  getGrindingPage,
  getGrindingsEndedOn,
  startOperation,
} from "./grindingApi";

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

    const operations = await getGrindingOperations({ project: "6" });

    expect(requested?.searchParams.get("project")).toBe("6");
    expect(operations).toMatchObject([
      { id: "5", project: "6", machine: 2, shipmentNumber: "SHP-2026-00002", bags: 10 },
    ]);
  });
});

describe("getGrindingsEndedOn", () => {
  const ended = (id: number, end: string) => ({
    id,
    shipment_number: `SH-${id}`,
    customer_name: "sidi",
    grinder_code: "P6-2",
    project_name: "Zouérat 1",
    bags_count: 3,
    start_time: "2026-10-11T06:00:00Z",
    end_time: end,
    operator_name: "med",
    grinding_cost: "150000.00",
    notes: "",
    created_at: "2026-10-11T06:00:00Z",
    updated_at: "2026-10-11T06:00:00Z",
  });

  it("reads the finished grindings, latest end first, and stops at the first of another day", async () => {
    const asked: URLSearchParams[] = [];
    server.use(
      http.get(`${API}/grinding-operations/`, ({ request }) => {
        asked.push(new URL(request.url).searchParams);
        return HttpResponse.json({
          count: 60,
          results: [ended(7, "2026-10-12T15:00:00Z"), ended(6, "2026-10-11T20:00:00Z")],
        });
      }),
    );

    const operations = await getGrindingsEndedOn("2026-10-12");

    expect(operations.map((operation) => operation.id)).toEqual(["7"]);
    expect(asked).toHaveLength(1);
    expect(asked[0]?.get("is_running")).toBe("false");
    expect(asked[0]?.get("ordering")).toBe("-end_time");
  });
});

describe("startOperation", () => {
  it("creates the operation with its cost and moves a waiting shipment to grinding", async () => {
    let created: unknown;
    server.use(
      http.post(`${API}/grinding-operations/`, async ({ request }) => {
        created = await request.json();
        return HttpResponse.json({}, { status: 201 });
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
      },
    );

    expect(result).toEqual({ ok: true });
    expect(created).toEqual({
      shipment: 2,
      grinder: 8,
      bags_count: 2,
      start_time: "2026-10-08T08:00:00.000Z",
      operator: 4,
      notes: "",
    });
  });
});

describe("getGrindingPage", () => {
  it("asks one page of 25 with the search and filters, and gives the backend's total", async () => {
    let asked = new URLSearchParams();
    server.use(
      http.get(`${API}/grinding-operations/`, ({ request }) => {
        asked = new URL(request.url).searchParams;
        return HttpResponse.json({ count: 31, results: [] });
      }),
    );

    const slice = await getGrindingPage(
      {
        project: "3",
        search: "SH",
        ordering: "-start_time",
        grinder: "7",
        running: false,
        refined: false,
        customer: "4",
        startedFrom: "2026-10-01",
        startedTo: "2026-10-05",
      },
      2,
    );

    expect(slice.total).toBe(31);
    expect(Object.fromEntries(asked)).toEqual({
      ordering: "-start_time",
      page: "2",
      page_size: "25",
      project: "3",
      search: "SH",
      grinder: "7",
      is_running: "false",
      refined: "false",
      shipment__customer: "4",
      start_time__date__gte: "2026-10-01",
      start_time__date__lte: "2026-10-05",
    });
  });
});
