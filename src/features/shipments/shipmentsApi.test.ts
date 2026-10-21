import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { filledShipmentValues } from "./shipmentFormTesting";
import { createShipment } from "./shipmentsApi";

const API = `${window.location.origin}/api/v1`;
const server = setupServer();
const phoneTaken = (owner: string) => `pris par ${owner}`;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  server.use(
    http.get(`${API}/customers/`, () =>
      HttpResponse.json({
        count: 1,
        results: [
          {
            id: 7,
            full_name: "Sidi Salem",
            phone: "+22246109325",
            is_active: true,
            created_at: "2026-10-01T08:00:00Z",
            updated_at: "2026-10-01T08:00:00Z",
          },
        ],
      }),
    ),
    http.post(`${API}/shipments/`, () => HttpResponse.json({ id: 52 }, { status: 201 })),
  );
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("createShipment", () => {
  it("records the debt typed with a new shipment as the shipment's first debt", async () => {
    let debt: unknown;
    server.use(
      http.post(`${API}/shipment-debts/`, async ({ request }) => {
        debt = await request.json();
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    expect(await createShipment(filledShipmentValues, phoneTaken)).toEqual({
      ok: true,
      id: "52",
      debtFailed: false,
    });
    expect(debt).toEqual({
      shipment: 52,
      amount: "250",
      description: "Avance sur le prochain voyage",
    });
  });

  it("records no debt when none was typed", async () => {
    expect(await createShipment({ ...filledShipmentValues, debt: Number.NaN }, phoneTaken)).toEqual(
      { ok: true, id: "52", debtFailed: false },
    );
  });

  it("keeps the saved shipment and says when its debt could not be recorded", async () => {
    server.use(http.post(`${API}/shipment-debts/`, () => new HttpResponse(null, { status: 500 })));

    expect(await createShipment(filledShipmentValues, phoneTaken)).toEqual({
      ok: true,
      id: "52",
      debtFailed: true,
    });
  });
});
