import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { getShipmentPage, getShipments } from "./shipmentsApi";

const API = `${window.location.origin}/api/v1`;
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function captureQuery() {
  const requested: URLSearchParams[] = [];

  server.use(
    http.get(`${API}/shipments/`, ({ request }) => {
      requested.push(new URL(request.url).searchParams);
      return HttpResponse.json({ count: 0, results: [] });
    }),
  );

  return requested;
}

describe("getShipments", () => {
  it("asks the backend for the chosen statuses only, comma-separated", async () => {
    const requested = captureQuery();

    await getShipments({ project: "6", statuses: ["pending", "grinding"] });

    expect(requested[0]?.getAll("status__in")).toEqual(["pending,grinding"]);
    expect(requested[0]?.get("project")).toBe("6");
  });

  it("asks for every status when none is chosen", async () => {
    const requested = captureQuery();

    await getShipments({ customer: "3" });

    expect(requested[0]?.has("status__in")).toBe(false);
    expect(requested[0]?.get("customer")).toBe("3");
  });
});

function apiShipment(id: number) {
  return {
    id,
    number: `SH-${id}`,
    customer: 7,
    customer_name: "Ahmed",
    customer_phone: "+22222411830",
    arrival_date: "2026-10-01T08:00:00Z",
    bags_count: 10,
    remaining_bags: 10,
    bag_transport_cost_per_bag: "100.00",
    transport_total: "1000.00",
    amount_left_to_pay: "1000.00",
    is_fully_paid: false,
    transport_method: "truck",
    source: "Chami",
    project: 3,
    status: "pending",
    is_ground: false,
  };
}

describe("getShipmentPage", () => {
  const filter = {
    project: "3",
    statuses: ["completed", "cancelled"],
    ordering: "-arrival_date",
    search: "SH",
    customer: "7",
    arrivedFrom: "2026-10-01",
    arrivedTo: "2026-10-05",
    fullyPaid: false,
    transport: "hilux",
  } as const;

  it("sends the search and filters, the arrival days whole, and gives the total", async () => {
    const requested: URLSearchParams[] = [];
    server.use(
      http.get(`${API}/shipments/`, ({ request }) => {
        requested.push(new URL(request.url).searchParams);
        return HttpResponse.json({ count: 42, results: [apiShipment(1)] });
      }),
    );

    const slice = await getShipmentPage(filter, 1);

    expect(slice.total).toBe(42);
    expect(slice.shipments.map((shipment) => shipment.shipmentNumber)).toEqual(["SH-1"]);
    expect(requested).toHaveLength(1);
    expect(Object.fromEntries(requested[0] ?? [])).toEqual({
      ordering: "-arrival_date",
      page: "1",
      page_size: "25",
      project: "3",
      status__in: "completed,cancelled",
      search: "SH",
      customer: "7",
      arrival_date__gte: "2026-10-01T00:00:00",
      arrival_date__lte: "2026-10-05T23:59:59.999999",
      is_fully_paid: "false",
      transport_method: "hilux",
    });
  });

  it("asks the page that comes next", async () => {
    const requested: URLSearchParams[] = [];
    server.use(
      http.get(`${API}/shipments/`, ({ request }) => {
        requested.push(new URL(request.url).searchParams);
        return HttpResponse.json({ count: 42, results: [apiShipment(21)] });
      }),
    );

    await getShipmentPage(filter, 3);

    expect(requested[0]?.get("page")).toBe("3");
    expect(requested[0]?.get("page_size")).toBe("25");
  });
});
