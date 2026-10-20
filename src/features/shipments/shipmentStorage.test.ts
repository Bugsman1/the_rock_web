import { describe, expect, it } from "vitest";
import type { MillingOperation } from "@/lib/grinding";
import type { ShipmentRecord } from "@/lib/shipments";
import {
  bagCount,
  bagShare,
  clientBags,
  isInStorage,
  shipmentsByArrival,
  shipmentsOfProject,
  storedShipments,
  topClientsByBags,
} from "./shipmentStorage";
import type { StoredShipment } from "./shipmentStorage";

describe("storage", () => {
  function record(overrides: Partial<ShipmentRecord>): ShipmentRecord {
    return {
      id: "1",
      shipmentNumber: "SH-1",
      customerName: "a",
      phone: "+222 22 33 44 55",
      arrivedAt: "2026-10-01T00:00:00Z",
      bagCount: 10,
      project: "zouerate1",
      status: "pending",
      stage: "pending",
      source: "Chami",
      notes: "",
      transportTotal: 0,
      paid: 0,
      debt: 0,
      ...overrides,
    };
  }

  function stored(overrides: Partial<ShipmentRecord>): StoredShipment {
    const base = record(overrides);

    return { ...base, remainingBags: base.bagCount };
  }

  const records = [
    stored({
      shipmentNumber: "SH-1",
      customerName: "b",
      bagCount: 20,
      arrivedAt: "2026-10-03T00:00:00Z",
    }),
    stored({
      shipmentNumber: "SH-2",
      customerName: "a",
      bagCount: 50,
      arrivedAt: "2026-10-01T00:00:00Z",
    }),
    stored({
      shipmentNumber: "SH-3",
      customerName: "c",
      bagCount: 35,
      arrivedAt: "2026-10-02T00:00:00Z",
    }),
  ];

  describe("isInStorage", () => {
    it("keeps the shipments waiting or in grinding", () => {
      expect(isInStorage(record({ status: "pending" }))).toBe(true);
      expect(isInStorage(record({ status: "grinding" }))).toBe(true);
    });

    it("drops completed shipments", () => {
      expect(isInStorage(record({ status: "completed" }))).toBe(false);
    });
  });

  const mixed = [
    record({ shipmentNumber: "SH-10", status: "pending" }),
    record({ shipmentNumber: "SH-11", status: "grinding" }),
    record({ shipmentNumber: "SH-12", status: "completed" }),
    record({ shipmentNumber: "SH-13", status: "pending", project: "sfariyat1" }),
  ];

  function numbers(list: readonly ShipmentRecord[]) {
    return list.map((item) => item.shipmentNumber);
  }

  const grinding: MillingOperation = {
    id: "op",
    project: "zouerate1",
    machine: 1,
    shipmentNumber: "SH-11",
    client: "a",
    bags: 2,
    operatorName: "Aicha",
    startedAt: "2026-10-08T06:00:00.000Z",
    estimatedEndAt: "2026-10-08T12:00:00.000Z",
    notes: "",
  };

  describe("storedShipments", () => {
    it("keeps the project's shipments that still have bags to grind, with the bags left", () => {
      const left = storedShipments(mixed, [grinding], "zouerate1");

      expect(numbers(left)).toEqual(["SH-10", "SH-11"]);
      expect(left.map((shipment) => shipment.remainingBags)).toEqual([10, 8]);
      expect(storedShipments(mixed, [], "sfariyat2")).toEqual([]);
    });

    it("drops a shipment once all its bags are on machines or ground", () => {
      expect(numbers(storedShipments(mixed, [{ ...grinding, bags: 10 }], "zouerate1"))).toEqual([
        "SH-10",
      ]);
    });

    it("covers every project when none is given", () => {
      expect(numbers(storedShipments(mixed, []))).toEqual(["SH-10", "SH-11", "SH-13"]);
    });
  });

  describe("shipmentsOfProject", () => {
    it("keeps every shipment of the project, whatever its status", () => {
      expect(numbers(shipmentsOfProject(mixed, "zouerate1"))).toEqual(["SH-10", "SH-11", "SH-12"]);
    });
  });

  describe("bagCount", () => {
    it("sums the bags left", () => {
      expect(bagCount(records)).toBe(105);
      expect(bagCount([{ ...stored({}), remainingBags: 1.5 }])).toBe(1.5);
    });

    it("is zero with no shipments", () => {
      expect(bagCount([])).toBe(0);
    });
  });

  describe("clientBags", () => {
    it("adds up the shipments of the same client", () => {
      expect(
        clientBags([
          ...records,
          stored({ shipmentNumber: "SH-4", customerName: "b", bagCount: 5 }),
        ]),
      ).toEqual([
        { name: "b", bagCount: 25 },
        { name: "a", bagCount: 50 },
        { name: "c", bagCount: 35 },
      ]);
    });
  });

  describe("topClientsByBags", () => {
    const clients = clientBags(records);

    it("orders clients by the most bags first", () => {
      expect(topClientsByBags(clients).map((client) => client.name)).toEqual(["a", "c", "b"]);
    });

    it("keeps only the requested number", () => {
      expect(topClientsByBags(clients, 2).map((client) => client.name)).toEqual(["a", "c"]);
    });
  });

  describe("shipmentsByArrival", () => {
    it("queues the earliest arrival first", () => {
      expect(shipmentsByArrival(records).map((item) => item.shipmentNumber)).toEqual([
        "SH-2",
        "SH-3",
        "SH-1",
      ]);
    });

    it("leaves the source list untouched", () => {
      const source = [...records];
      shipmentsByArrival(source);
      expect(source.map((item) => item.shipmentNumber)).toEqual(["SH-1", "SH-2", "SH-3"]);
    });
  });

  describe("bagShare", () => {
    it("fills the bar completely for the largest holder", () => {
      expect(bagShare(50, 50)).toBe(100);
    });

    it("scales the rest against the largest", () => {
      expect(bagShare(25, 50)).toBe(50);
    });

    it("stays at zero when there are no bags at all", () => {
      expect(bagShare(0, 0)).toBe(0);
    });
  });
});
