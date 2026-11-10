import { describe, expect, it } from "vitest";
import type { Machine, MillingOperation } from "@/lib/grinding";
import type { Project } from "@/lib/projects";
import type { ShipmentRecord } from "@/lib/shipments";
import {
  combineSummaries,
  createMercuryAdditionSchema,
  createMercurySchema,
  mercuryTotalAfter,
  findMachine,
  isBacklogged,
  millingOf,
  millingQueue,
  operationShipments,
  withBagsFreedBy,
  millingShipments,
  millingSummaryFromApi,
  projectsForSite,
} from "./milling";
import type { MillingShipment } from "./milling";

function operation(overrides: Partial<MillingOperation>): MillingOperation {
  return {
    id: "op",
    project: "3",
    machine: 1,
    shipmentNumber: "SH-1",
    client: "Client",
    bags: 2,
    operatorName: "Aicha",
    startedAt: "2026-10-08T06:00:00.000Z",
    estimatedEndAt: "2026-10-08T12:00:00.000Z",
    notes: "",
    ...overrides,
  };
}

const shipment: MillingShipment = {
  id: "1",
  shipmentNumber: "SH-1",
  client: "Client",
  project: "3",
  bags: 6,
  remainingBags: 6,
  arrivedAt: "2026-10-08T01:00:00.000Z",
  started: true,
};

describe("machines", () => {
  it("finds a machine of a project by number", () => {
    const machine: Machine = { grinderId: "g1", project: "4", number: 1, inMaintenance: false };

    expect(findMachine([machine], "4", 1)).toEqual(machine);
    expect(findMachine([machine], "4", 9)).toBeUndefined();
  });
});

describe("shipments in grinding", () => {
  it("queues this project's shipments with bags left, earliest arrival first", () => {
    const later = { ...shipment, shipmentNumber: "SH-2", arrivedAt: "2026-10-08T03:00:00.000Z" };
    const done = { ...shipment, shipmentNumber: "SH-3", remainingBags: 0 };
    const elsewhere = { ...shipment, shipmentNumber: "SH-4", project: "4" };

    expect(
      millingQueue([later, done, elsewhere, shipment], "3").map((item) => item.shipmentNumber),
    ).toEqual(["SH-1", "SH-2"]);
  });

  it("gives the start and edit forms each queued shipment with the bags the backend left", () => {
    expect(operationShipments([{ ...shipment, remainingBags: 4.5 }])).toEqual([
      {
        id: shipment.id,
        shipmentNumber: "SH-1",
        client: shipment.client,
        bags: shipment.bags,
        remainingBags: 4.5,
        arrivedAt: shipment.arrivedAt,
      },
    ]);
  });

  it("gives an edited grinding's bags back to its own shipment only", () => {
    const edited = operation({ shipmentNumber: "SH-1", bags: 2 });
    const other = { ...shipment, shipmentNumber: "SH-2", remainingBags: 3 };

    expect(
      withBagsFreedBy([{ ...shipment, remainingBags: 0 }, other], edited).map((item) => [
        item.shipmentNumber,
        item.remainingBags,
      ]),
    ).toEqual([
      ["SH-1", 2],
      ["SH-2", 3],
    ]);
  });

  it("keeps the shipments waiting or in grinding, marking those already started", () => {
    const record: ShipmentRecord = {
      id: "12",
      shipmentNumber: "SH-12",
      customerId: "1",
      customerName: "Sidi",
      phone: "+222 46 10 93 25",
      arrivedAt: "2026-10-08T01:00:00.000Z",
      bagCount: 16,
      testBags: 0,
      remainingBags: 10,
      project: "3",
      status: "grinding",
      stage: "grinding",
      source: "Chami",
      transportMethod: "truck",
      notes: "",
      transportTotal: 0,
      paid: 0,
      amountLeft: 0,
      fullyPaid: true,
      debt: 0,
    };

    expect(
      millingShipments([
        record,
        { ...record, id: "13", status: "pending" },
        { ...record, id: "14", status: "completed" },
        { ...record, id: "15", status: "cancelled", stage: "cancelled" },
      ]).map((shipment) => [shipment.id, shipment.started]),
    ).toEqual([
      ["12", true],
      ["13", false],
    ]);
  });
});

describe("summary", () => {
  const rows = millingSummaryFromApi([
    {
      project: 3,
      project_name: "Zouérat 1",
      bags_waiting: "4.0",
      waiting_shipments: 1,
      bags_grinding: "2.0",
      bags_ground_today: "3.5",
      machines_running: 1,
      machines_in_service: 2,
    },
    {
      project: 4,
      project_name: "Sfariyat 1",
      bags_waiting: "4.0",
      waiting_shipments: 1,
      bags_grinding: "0.0",
      bags_ground_today: "0.0",
      machines_running: 0,
      machines_in_service: 1,
    },
  ]);
  const zero = {
    bagsWaiting: 0,
    waitingShipments: 0,
    bagsMilling: 0,
    bagsMilledToday: 0,
    machinesRunning: 0,
    machinesInService: 0,
  };

  it("reads a project's bags and machines from the backend's summary", () => {
    expect(millingOf(rows, "3")).toEqual({
      project: "3",
      bagsWaiting: 4,
      waitingShipments: 1,
      bagsMilling: 2,
      bagsMilledToday: 3.5,
      machinesRunning: 1,
      machinesInService: 2,
    });
  });

  it("gives zeros to a project missing from the summary", () => {
    expect(millingOf(rows, "9")).toEqual(zero);
  });

  it("sums several projects", () => {
    expect(combineSummaries([millingOf(rows, "3"), millingOf(rows, "4")])).toEqual({
      bagsWaiting: 8,
      waitingShipments: 2,
      bagsMilling: 2,
      bagsMilledToday: 3.5,
      machinesRunning: 1,
      machinesInService: 3,
    });
    expect(combineSummaries([])).toEqual(zero);
  });

  it("filters projects by site", () => {
    const projects: Project[] = [
      { id: "1", name: "Zouérat 1", site: "zouerat", status: "active" },
      { id: "2", name: "Sfariyat 1", site: "sfariyat", status: "active" },
    ];

    expect(projectsForSite(projects, "sfariyat").map((project) => project.id)).toEqual(["2"]);
    expect(projectsForSite(projects, "all")).toHaveLength(2);
  });
});

describe("milling flow", () => {
  it("calls the waiting bags a backlog from 50 bags", () => {
    expect(isBacklogged(49)).toBe(false);
    expect(isBacklogged(50)).toBe(true);
  });
});

describe("mercury added to a grinding", () => {
  const schema = createMercurySchema({ required: "required", quantityTooLow: "too low" });

  it("accepts a first quantity of 100 grams or more", () => {
    expect(schema.safeParse({ quantity: 100 }).success).toBe(true);
    expect(schema.safeParse({ quantity: 250.5 }).success).toBe(true);
  });

  it("refuses an empty quantity or one under 100 grams", () => {
    expect(schema.safeParse({ quantity: Number.NaN }).error?.issues[0]?.message).toBe("required");
    expect(schema.safeParse({ quantity: 99.9 }).error?.issues[0]?.message).toBe("too low");
    expect(schema.safeParse({ quantity: 0 }).error?.issues[0]?.message).toBe("too low");
  });
});

describe("extra mercury on a grinding", () => {
  const schema = createMercuryAdditionSchema({ quantityInvalid: "quantity" });

  it("takes any quantity above zero, with an optional note", () => {
    expect(schema.safeParse({ quantity: 0.5, notes: "" }).success).toBe(true);
    expect(schema.safeParse({ quantity: 30, notes: " Pas assez " }).data?.notes).toBe("Pas assez");
  });

  it("refuses an empty, zero or negative quantity", () => {
    for (const quantity of [Number.NaN, 0, -5]) {
      expect(schema.safeParse({ quantity, notes: "" }).error?.issues[0]?.message).toBe("quantity");
    }
  });

  it("adds the typed quantity to the mercury already in", () => {
    expect(mercuryTotalAfter(120, 30.5)).toBe(150.5);
    expect(mercuryTotalAfter(120, Number.NaN)).toBeUndefined();
    expect(mercuryTotalAfter(120, 0)).toBeUndefined();
  });
});
