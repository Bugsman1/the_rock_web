import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { RefiningValues } from "./refining";
import { createRefiningOperation } from "./refiningApi";

const API = `${window.location.origin}/api/v1`;
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const values: RefiningValues = {
  workerId: "2",
  date: "2026-10-12",
  time: "09:30",
  weightBefore: 1200,
  weightAfter: 1150,
  goldWithMaterial: 20,
  goldWithoutMaterial: 14,
  lossReason: "normalShortage",
  notes: "",
};

const target = { grindingOperationId: "5", refinedAt: "2026-10-12T09:30:00.000Z" };

describe("createRefiningOperation", () => {
  it("sends the refining with its loss, which the backend takes from the stock", async () => {
    let body: unknown;
    server.use(
      http.post(`${API}/refining-operations/`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: 31 }, { status: 201 });
      }),
    );

    expect(await createRefiningOperation(values, target)).toEqual({ ok: true });
    expect(body).toMatchObject({ grinding_operation: 5 });
    expect(body).not.toHaveProperty("loss");
    expect(body).not.toHaveProperty("bags_count");
  });

  it("shows on the loss field why the stock refused it", async () => {
    server.use(
      http.post(`${API}/refining-operations/`, () =>
        HttpResponse.json({ loss: ["Only 50 of this resource is left."] }, { status: 400 }),
      ),
    );

    expect(await createRefiningOperation(values, target)).toEqual({
      ok: false,
      fieldErrors: { loss: "Only 50 of this resource is left." },
      failed: false,
    });
  });
});
