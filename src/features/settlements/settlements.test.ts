import { describe, expect, it } from "vitest";
import {
  createNewSettlementSchema,
  newSettlementToApi,
  projectsOfShipments,
  settlementErrorsFromApi,
  settlementFromApi,
  settlementsOf,
  settlementSummaryFromApi,
} from "./settlements";
import { apiSettlement, shipmentRecord } from "./settlementsTesting";

const messages = {
  amountInvalid: "amount",
  descriptionTooLong: "too long",
  shipmentsRequired: "shipments",
};

const values = {
  shipmentIds: ["1", "2"],
  grindingCostPerBag: 250,
  refiningCostPerGram: Number.NaN,
  debt: 2000.555,
  debtDescription: "  Avance  ",
};

describe("settlementFromApi", () => {
  it("reads the settlement, what the user entered for it and its totals", () => {
    const settlement = settlementFromApi(apiSettlement);

    expect(settlement).toMatchObject({
      id: "4",
      number: "STL-2026-00004",
      project: "3",
      shipmentIds: ["1", "2"],
      grindingCostPerBag: 250,
      refiningCostPerGram: 1500,
      debt: 2000,
      debtDescription: "Avance sur carburant",
      createdByName: "Sidi",
    });
    expect(settlement.totals).toEqual({
      bags: 20,
      bagsTransport: 21000,
      passengersTransport: 3000,
      unloading: 400,
      gold: 12.25,
      shipmentsDebt: 250,
      grindingCost: 5000,
      refiningCost: 18375,
      extraDebt: 2000,
      grandTotal: 49625,
    });
  });
});

describe("settlement summary", () => {
  const rows = settlementSummaryFromApi([
    { project: 3, project_name: "Zouérat 1", shipments_waiting: 2, settlements_made: 5 },
  ]);

  it("reads a project's shipments waiting and settlements made from the backend's summary", () => {
    expect(settlementsOf(rows, "3")).toEqual({ project: "3", waiting: 2, settled: 5 });
  });

  it("gives zeros to a project missing from the summary", () => {
    expect(settlementsOf(rows, "9")).toEqual({ waiting: 0, settled: 0 });
  });
});

describe("projectsOfShipments", () => {
  it("lists each project of the shipments once", () => {
    const first = shipmentRecord({ id: "1" });
    const second = shipmentRecord({ id: "2" });
    const elsewhere = shipmentRecord({ id: "3", project: "5" });

    expect(projectsOfShipments([first, second, elsewhere])).toEqual(["3", "5"]);
  });
});

describe("createNewSettlementSchema", () => {
  const schema = createNewSettlementSchema(messages);

  it("accepts empty amounts and needs at least one shipment", () => {
    expect(schema.safeParse(values).success).toBe(true);
    expect(schema.safeParse({ ...values, shipmentIds: [] }).error?.issues[0]?.message).toBe(
      "shipments",
    );
  });

  it("refuses a negative amount and a description over 200 characters", () => {
    expect(schema.safeParse({ ...values, debt: -1 }).error?.issues[0]?.message).toBe("amount");
    expect(
      schema.safeParse({ ...values, debtDescription: "a".repeat(201) }).error?.issues[0]?.message,
    ).toBe("too long");
  });
});

describe("newSettlementToApi", () => {
  it("sends the customer, the shipments and every amount, empty ones as 0", () => {
    expect(newSettlementToApi("7", values)).toEqual({
      customer: 7,
      shipments: [1, 2],
      grinding_cost_per_bag: "250",
      refining_cost_per_gram: "0",
      debt: "2000.56",
      debt_description: "Avance",
    });
  });
});

describe("settlementErrorsFromApi", () => {
  it("puts the backend's refusals on the matching field", () => {
    expect(
      settlementErrorsFromApi({
        shipments: "Déjà réglée : SHP-00001.",
        refining_cost_per_gram: "Négatif.",
        debt_description: "Trop long.",
        project: "ignoré",
      }),
    ).toEqual({
      shipmentIds: "Déjà réglée : SHP-00001.",
      refiningCostPerGram: "Négatif.",
      debtDescription: "Trop long.",
    });
  });
});
