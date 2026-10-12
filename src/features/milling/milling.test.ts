import { describe, expect, it } from "vitest";
import type { Machine, MillingOperation } from "@/lib/grinding";
import type { Project } from "@/lib/projects";
import type { ShipmentRecord } from "@/lib/shipments";
import {
  bagsMilledOn,
  byMachineStatus,
  combineSummaries,
  findMachine,
  millingQueue,
  millingShipments,
  operationHistory,
  projectsForSite,
  projectSummary,
  shipmentMillingStatus,
  shipmentStatusFor,
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
  arrivedAt: "2026-10-08T01:00:00.000Z",
  started: true,
};

describe("machines", () => {
  it("builds one value per machine status", () => {
    expect(byMachineStatus((status) => status.length)).toEqual({
      running: 7,
      idle: 4,
      maintenance: 11,
    });
  });

  it("finds a machine of a project by number", () => {
    const machine: Machine = { grinderId: "g1", project: "4", number: 1, inMaintenance: false };

    expect(findMachine([machine], "4", 1)).toEqual(machine);
    expect(findMachine([machine], "4", 9)).toBeUndefined();
  });
});

describe("operations", () => {
  it("lists every grinding of a machine, running ones included, newest first", () => {
    const operations = [
      operation({
        id: "old",
        startedAt: "2026-10-06T06:00:00.000Z",
        endedAt: "2026-10-06T12:00:00.000Z",
      }),
      operation({
        id: "older",
        startedAt: "2026-10-05T06:00:00.000Z",
        endedAt: "2026-10-05T12:00:00.000Z",
      }),
      operation({ id: "current" }),
      operation({ id: "other machine", machine: 2, endedAt: "2026-10-07T12:00:00.000Z" }),
    ];

    expect(operationHistory(operations, "3", 1).map((item) => item.id)).toEqual([
      "current",
      "old",
      "older",
    ]);
  });

  it("counts the bags finished on a given day", () => {
    const operations = [
      operation({ bags: 2 }),
      operation({ bags: 2, endedAt: "2026-10-08T05:00:00.000Z", bagsMilled: 1 }),
      operation({ bags: 2, endedAt: "2026-10-07T23:00:00.000Z", bagsMilled: 2 }),
    ];

    expect(bagsMilledOn(operations, "2026-10-08T15:00:00.000Z")).toBe(1);
  });
});

describe("shipments in grinding", () => {
  it("moves from partially ground to ground once every bag is done", () => {
    const first = operation({ id: "a", bags: 4 });
    const firstEnded = { ...first, endedAt: "2026-10-08T18:00:00.000Z", bagsMilled: 4 };
    const second = operation({ id: "b", machine: 2, bags: 2 });
    const secondEnded = { ...second, endedAt: "2026-10-08T18:00:00.000Z", bagsMilled: 2 };

    expect(shipmentMillingStatus(shipment, [])).toBe("pending");
    expect(shipmentMillingStatus(shipment, [first])).toBe("partiallyMilled");
    expect(shipmentMillingStatus(shipment, [firstEnded, second])).toBe("partiallyMilled");
    expect(shipmentMillingStatus(shipment, [firstEnded, secondEnded])).toBe("milled");
  });

  it("completes a shipment once all its bags are ground, otherwise keeps it in grinding", () => {
    const ended = operation({ bags: 6, endedAt: "2026-10-08T12:00:00.000Z", bagsMilled: 6 });

    expect(shipmentStatusFor(shipment, [ended])).toBe("completed");
    expect(shipmentStatusFor(shipment, [{ ...ended, bagsMilled: 5 }])).toBe("grinding");
    expect(shipmentStatusFor(shipment, [operation({ bags: 6 })])).toBe("grinding");
  });

  it("queues this project's shipments with bags left, earliest arrival first", () => {
    const later = { ...shipment, shipmentNumber: "SH-2", arrivedAt: "2026-10-08T03:00:00.000Z" };
    const done = { ...shipment, shipmentNumber: "SH-3", bags: 2 };
    const elsewhere = { ...shipment, shipmentNumber: "SH-4", project: "4" };
    const operations = [
      operation({ shipmentNumber: "SH-3", endedAt: "2026-10-08T12:00:00.000Z", bagsMilled: 2 }),
    ];

    expect(
      millingQueue([later, done, elsewhere, shipment], operations, "3").map(
        (item) => item.shipmentNumber,
      ),
    ).toEqual(["SH-1", "SH-2"]);
  });

  it("keeps the shipments waiting or in grinding, marking those already started", () => {
    const record: ShipmentRecord = {
      id: "12",
      shipmentNumber: "SH-12",
      customerName: "Sidi",
      phone: "+222 46 10 93 25",
      arrivedAt: "2026-10-08T01:00:00.000Z",
      bagCount: 16,
      project: "3",
      status: "grinding",
      source: "Chami",
      notes: "",
    };

    expect(
      millingShipments([
        record,
        { ...record, id: "13", status: "pending" },
        { ...record, id: "14", status: "completed" },
      ]).map((shipment) => [shipment.id, shipment.started]),
    ).toEqual([
      ["12", true],
      ["13", false],
    ]);
  });
});

describe("summary", () => {
  const NOW = "2026-10-08T15:00:00.000Z";
  const machines: Machine[] = [
    { grinderId: "g1", project: "3", number: 1, inMaintenance: false },
    { grinderId: "g2", project: "3", number: 2, inMaintenance: false },
    { grinderId: "g3", project: "3", number: 3, inMaintenance: true },
    { grinderId: "g4", project: "4", number: 1, inMaintenance: false },
  ];
  const shipments: MillingShipment[] = [
    shipment,
    { ...shipment, id: "2", shipmentNumber: "SH-2", bags: 3 },
    { ...shipment, id: "3", shipmentNumber: "SH-3", project: "4", bags: 4 },
  ];
  const operations = [
    operation({ bags: 2 }),
    operation({
      id: "done",
      machine: 2,
      shipmentNumber: "SH-2",
      bags: 3,
      endedAt: "2026-10-08T09:00:00.000Z",
      bagsMilled: 3,
    }),
  ];
  const records = { machines, operations, shipments };

  it("counts the machines, the bags on machines and waiting, and today's ground bags", () => {
    expect(projectSummary(records, "3", NOW)).toEqual({
      machines: { running: 1, idle: 1, maintenance: 1, total: 3 },
      bagsMilling: 2,
      bagsWaiting: 4,
      bagsMilledToday: 3,
      waitingShipments: 1,
    });
  });

  it("sums several projects", () => {
    const total = combineSummaries([
      projectSummary(records, "3", NOW),
      projectSummary(records, "4", NOW),
    ]);

    expect(total.machines).toEqual({ running: 1, idle: 2, maintenance: 1, total: 4 });
    expect(total.bagsWaiting).toBe(8);
    expect(total.waitingShipments).toBe(2);
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
