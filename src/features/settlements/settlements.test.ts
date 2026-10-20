import { describe, expect, it } from "vitest";
import {
  createNewSettlementSchema,
  customerOfShipment,
  projectSettlementSummary,
  settleableShipmentsOfProject,
  newSettlementToApi,
  projectsOfShipments,
  settlementErrorsFromApi,
  settlementFromApi,
  settleableShipments,
} from "./settlements";
import { apiSettlement, shipmentRecord } from "./settlementsTesting";

const messages = {
  amountInvalid: "amount",
  descriptionTooLong: "too long",
  shipmentsRequired: "shipments",
};

const values = {
  shipmentIds: ["1", "2"],
  grindingCost: 5000,
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
      grindingCost: 5000,
      refiningCostPerGram: 1500,
      debt: 2000,
      debtDescription: "Avance sur carburant",
      createdByName: "Sidi",
    });
    expect(settlement.totals).toEqual({
      bagsTransport: 21000,
      passengersTransport: 3000,
      gold: 12.25,
      shipmentsDebt: 250,
      grindingCost: 5000,
      refiningCost: 18375,
      extraDebt: 2000,
      grandTotal: 49625,
    });
  });
});

describe("shipments to settle", () => {
  const first = shipmentRecord({ id: "1" });
  const running = shipmentRecord({ id: "2", status: "grinding", stage: "grinding" });
  const elsewhere = shipmentRecord({ id: "3", project: "5" });

  it("offers only the shipments whose every bag is ground and refined", () => {
    const allGround = shipmentRecord({ id: "4", status: "grinding", stage: "refining" });

    expect(
      settleableShipments([first, running, allGround, elsewhere], []).map(({ id }) => id),
    ).toEqual(["1", "3"]);
  });

  it("leaves out the shipments another settlement already holds", () => {
    const settled = settlementFromApi({ ...apiSettlement, shipments: [1] });

    expect(settleableShipments([first, elsewhere], [settled]).map(({ id }) => id)).toEqual(["3"]);
  });

  it("lists a project's shipments to settle, earliest arrival first", () => {
    const later = shipmentRecord({ id: "7", arrivedAt: "2026-10-05T08:00:00Z" });
    const earlier = shipmentRecord({ id: "8", arrivedAt: "2026-10-02T08:00:00Z" });

    expect(
      settleableShipmentsOfProject([later, elsewhere, earlier, running], [], "3").map(
        ({ id }) => id,
      ),
    ).toEqual(["8", "7"]);
  });

  it("counts a project's shipments to settle and its settlements", () => {
    const settled = settlementFromApi({ ...apiSettlement, shipments: [1] });

    expect(projectSettlementSummary([first, elsewhere], [settled], "3")).toEqual({
      waiting: 0,
      settled: 1,
    });
    expect(projectSettlementSummary([first, elsewhere], [settled], "5")).toEqual({
      waiting: 1,
      settled: 0,
    });
  });

  it("finds the customer of a shipment by phone, spaces or not", () => {
    const customers = [
      { id: "7", name: "Ahmed", phone: "+222 22 41 18 30", addedAt: "2026-10-01T08:00:00Z" },
    ];

    expect(customerOfShipment(customers, { phone: "+22222411830" })?.id).toBe("7");
    expect(customerOfShipment(customers, { phone: "+22246109325" })).toBeUndefined();
  });

  it("lists each project of the shipments once", () => {
    expect(projectsOfShipments([first, running, elsewhere])).toEqual(["3", "5"]);
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
      grinding_cost: "5000",
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
