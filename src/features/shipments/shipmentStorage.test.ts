import { describe, expect, it } from "vitest";
import type { ShipmentRecord } from "@/lib/shipments";
import {
  bagCount,
  clientBags,
  shipmentsOfProject,
  storedShipments,
  topCustomersFromApi,
  topCustomersOf,
} from "./shipmentStorage";

describe("storage", () => {
  function record(overrides: Partial<ShipmentRecord>): ShipmentRecord {
    return {
      id: "1",
      shipmentNumber: "SH-1",
      customerId: "1",
      customerName: "a",
      phone: "+222 22 33 44 55",
      arrivedAt: "2026-10-01T00:00:00Z",
      bagCount: 10,
      testBags: 0,
      remainingBags: 10,
      project: "zouerate1",
      status: "pending",
      stage: "pending",
      source: "Chami",
      transportMethod: "truck",
      notes: "",
      transportTotal: 0,
      paid: 0,
      amountLeft: 0,
      fullyPaid: true,
      debt: 0,
      ...overrides,
    };
  }

  function stored(overrides: Partial<ShipmentRecord>): ShipmentRecord {
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

  const mixed = [
    record({ shipmentNumber: "SH-10", status: "pending" }),
    record({ shipmentNumber: "SH-11", status: "grinding", remainingBags: 8 }),
    record({ shipmentNumber: "SH-12", status: "completed" }),
    record({ shipmentNumber: "SH-13", status: "pending", project: "sfariyat1" }),
  ];

  function numbers(list: readonly ShipmentRecord[]) {
    return list.map((item) => item.shipmentNumber);
  }

  describe("storedShipments", () => {
    it("keeps the project's shipments with bags still in storage, as the backend counts them", () => {
      const left = storedShipments(mixed, "zouerate1");

      expect(numbers(left)).toEqual(["SH-10", "SH-11"]);
      expect(left.map((shipment) => shipment.remainingBags)).toEqual([10, 8]);
      expect(storedShipments(mixed, "sfariyat2")).toEqual([]);
    });

    it("drops a shipment once all its bags are on machines or ground", () => {
      const allOnMachines = mixed.map((shipment) =>
        shipment.shipmentNumber === "SH-11" ? { ...shipment, remainingBags: 0 } : shipment,
      );

      expect(numbers(storedShipments(allOnMachines, "zouerate1"))).toEqual(["SH-10"]);
    });

    it("covers every project when none is given", () => {
      expect(numbers(storedShipments(mixed))).toEqual(["SH-10", "SH-11", "SH-13"]);
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

  describe("top customers by bags", () => {
    const rows = topCustomersFromApi([
      {
        project: 3,
        project_name: "Zouérat 1",
        total_bags: "20.0",
        results: [
          { id: 7, full_name: "Ahmed", phone: "+22222411830", bags: "5.0", percentage: "25.00" },
          { id: 8, full_name: "Sidi", phone: "+22246109325", bags: "3.0", percentage: "15.00" },
        ],
      },
      { project: 4, project_name: "Sfariyat 1", total_bags: "0.0", results: [] },
    ]);

    it("reads each project's customers with their share of its bags, in the backend's order", () => {
      expect(topCustomersOf(rows, "3")).toEqual([
        { id: "7", name: "Ahmed", bags: 5, percentage: 25 },
        { id: "8", name: "Sidi", bags: 3, percentage: 15 },
      ]);
    });

    it("gives no customer to a project without bags or missing from the list", () => {
      expect(topCustomersOf(rows, "4")).toEqual([]);
      expect(topCustomersOf(rows, "9")).toEqual([]);
    });
  });
});
