import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { getRefiningOperations } from "./refiningApi";

const OPERATIONS_URL = `${window.location.origin}/api/v1/refining-operations/`;
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const apiOperation = {
  id: 5,
  grinding_operation: 11,
  shipment_number: "SH-0004",
  customer_name: "Sidi",
  grinder_code: "P3-2",
  project_name: "Zouérat 1",
  worker_name: "Aicha",
  refining_date: "2026-10-12T09:30:00Z",
  weight_before: "120.500",
  weight_after: "118.250",
  weight_loss: "2.250",
  gold_weight: "14.300",
  loss_reason: "",
  notes: "",
  created_at: "2026-10-12T10:00:00Z",
  updated_at: "2026-10-12T10:00:00Z",
};

describe("getRefiningOperations", () => {
  it("reads every page of the operations, newest first", async () => {
    const requests: URL[] = [];
    server.use(
      http.get(OPERATIONS_URL, ({ request }) => {
        const url = new URL(request.url);
        requests.push(url);
        const id = url.searchParams.get("page") === "1" ? 5 : 6;
        return HttpResponse.json({ count: 2, results: [{ ...apiOperation, id }] });
      }),
    );

    const operations = await getRefiningOperations();

    expect(operations.map((operation) => operation.id)).toEqual(["5", "6"]);
    expect(operations[0]?.gold).toBe(14.3);
    expect(requests[0]?.searchParams.get("ordering")).toBe("-refining_date");
  });
});
