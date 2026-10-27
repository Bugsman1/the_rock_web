import { describe, expect, it } from "vitest";
import { amountLeftToPay } from "@/lib/shipments";
import type { ShipmentRecord } from "@/lib/shipments";
import {
  finishedShipments,
  emptyHistoryFilter,
  filterShipments,
  historyClients,
  isFilterActive,
} from "./shipmentHistory";

describe("history", () => {
  function record(
    shipmentNumber: string,
    customerName: string,
    arrivedAt: string,
    phone = "+222 22 33 44 55",
  ): ShipmentRecord {
    return {
      id: shipmentNumber,
      shipmentNumber,
      customerName,
      phone,
      arrivedAt,
      bagCount: 10,
      testBags: 0,
      project: "zouerate1",
      status: "completed",
      stage: "completed",
      source: "Chami",
      notes: "",
      transportTotal: 0,
      paid: 0,
      debt: 0,
    };
  }

  const records = [
    record("SH-1001", "محمد ولد أحمد", "2026-09-10T08:00:00Z", "+222 22 41 18 30"),
    record("SH-1002", "Fatima", "2026-09-20T23:30:00Z"),
    record("SH-1003", "زينب بنت أحمد", "2026-10-01T06:00:00Z"),
  ];

  function numbers(list: readonly ShipmentRecord[]) {
    return list.map((item) => item.shipmentNumber);
  }

  describe("filterShipments", () => {
    it("lists every shipment, newest first, without filters", () => {
      expect(numbers(filterShipments(records, emptyHistoryFilter))).toEqual([
        "SH-1003",
        "SH-1002",
        "SH-1001",
      ]);
    });

    it("keeps the shipments between both dates, both days included", () => {
      expect(
        numbers(
          filterShipments(records, { from: "2026-09-10", to: "2026-09-20", clientPhone: "" }),
        ),
      ).toEqual(["SH-1002", "SH-1001"]);
    });

    it("accepts an open-ended range", () => {
      expect(
        numbers(filterShipments(records, { from: "2026-09-15", to: "", clientPhone: "" })),
      ).toEqual(["SH-1003", "SH-1002"]);
      expect(
        numbers(filterShipments(records, { from: "", to: "2026-09-15", clientPhone: "" })),
      ).toEqual(["SH-1001"]);
    });

    it("ignores a date that is still being typed", () => {
      expect(filterShipments(records, { from: "12/09", to: "", clientPhone: "" })).toHaveLength(3);
    });

    it("keeps only the chosen client's shipments, whatever the phone's spacing", () => {
      expect(
        numbers(filterShipments(records, { from: "", to: "", clientPhone: "22411830" })),
      ).toEqual(["SH-1001"]);
    });

    it("combines the client and the dates", () => {
      const clientPhone = "+222 22 33 44 55";

      expect(
        numbers(filterShipments(records, { from: "2026-09-25", to: "", clientPhone })),
      ).toEqual(["SH-1003"]);
    });
  });

  describe("historyClients", () => {
    it("lists each client once, by name", () => {
      expect(historyClients(records)).toEqual([
        { name: "Fatima", phone: "+222 22 33 44 55" },
        { name: "محمد ولد أحمد", phone: "+222 22 41 18 30" },
      ]);
    });
  });

  describe("isFilterActive", () => {
    it("is off for the empty filter", () => {
      expect(isFilterActive(emptyHistoryFilter)).toBe(false);
    });

    it("is on as soon as one filter is set", () => {
      expect(isFilterActive({ from: "2026-09-01", to: "", clientPhone: "" })).toBe(true);
    });
  });
});

describe("payment and history", () => {
  const base: ShipmentRecord = {
    id: "1",
    shipmentNumber: "SH-1",
    customerName: "a",
    phone: "+222 22 33 44 55",
    arrivedAt: "2026-10-01T00:00:00Z",
    bagCount: 10,
    testBags: 0,
    project: "3",
    status: "completed",
    stage: "completed",
    source: "Chami",
    notes: "",
    transportTotal: 1000,
    paid: 400,
    debt: 0,
  };

  it("gives what is left to pay on a shipment, rounded to the cent", () => {
    expect(amountLeftToPay(base)).toBe(600);
    expect(amountLeftToPay({ ...base, transportTotal: 0.3, paid: 0.1 + 0.2 })).toBe(0);
    expect(amountLeftToPay({ ...base, paid: 1200 })).toBe(0);
  });

  it("keeps only the completed and the cancelled shipments", () => {
    const records: ShipmentRecord[] = [
      base,
      { ...base, id: "2", status: "pending" },
      { ...base, id: "3", status: "grinding" },
      { ...base, id: "4", status: "cancelled", stage: "cancelled" },
    ];

    expect(finishedShipments(records).map((record) => record.id)).toEqual(["1", "4"]);
  });
});
