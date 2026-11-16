import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { getSupplierChoices } from "./suppliersApi";

const API = `${window.location.origin}/api/v1`;
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("getSupplierChoices", () => {
  it("reads every supplier by name", async () => {
    let ordering: string | null = null;
    server.use(
      http.get(`${API}/suppliers/`, ({ request }) => {
        ordering = new URL(request.url).searchParams.get("ordering");
        return HttpResponse.json({
          count: 1,
          results: [
            {
              id: 5,
              name: "Sidi Fournitures",
              paid_amount: "0.00",
              delivered_amount: "0.00",
              balance: "0.00",
              resources: [],
              created_at: "2026-10-12T08:00:00Z",
              updated_at: "2026-10-12T08:00:00Z",
            },
          ],
        });
      }),
    );

    expect(await getSupplierChoices()).toEqual([{ id: "5", name: "Sidi Fournitures" }]);
    expect(ordering).toBe("name");
  });
});
