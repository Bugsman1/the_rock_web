import { describe, expect, it } from "vitest";
import { cancelErrorsFromApi, cancelToApi, createCancelShipmentSchema } from "./shipmentCancel";

describe("shipment cancellation", () => {
  it("takes an optional reason and sends it trimmed", () => {
    const schema = createCancelShipmentSchema();

    expect(schema.safeParse({ reason: "" }).success).toBe(true);
    expect(cancelToApi({ reason: "  Client parti " })).toEqual({ reason: "Client parti" });
  });

  it("puts the backend's reason error on the reason, and nothing else", () => {
    expect(cancelErrorsFromApi({ reason: "Trop long." })).toEqual({ reason: "Trop long." });
    expect(cancelErrorsFromApi({ status: "Déjà terminée." })).toEqual({});
  });
});
