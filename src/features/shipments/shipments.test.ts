import { describe, expect, it } from "vitest";
import type { ShipmentRecord } from "@/lib/shipments";
import {
  bagCount,
  bagShare,
  bagsCost,
  clientBags,
  emptyHistoryFilter,
  filterShipments,
  isFilterActive,
  isInStorage,
  isShipmentField,
  matchesQuery,
  passengersCost,
  shipmentErrorsFromApi,
  shipmentToApi,
  shipmentsByArrival,
  shipmentsOfProject,
  storedShipments,
  topClientsByBags,
  transportTotal,
} from "./shipments";
import type { NewShipmentValues } from "./shipments";

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
      source: "Chami",
      notes: "",
      ...overrides,
    };
  }

  const records = [
    record({
      shipmentNumber: "SH-1",
      customerName: "b",
      bagCount: 20,
      arrivedAt: "2026-10-03T00:00:00Z",
    }),
    record({
      shipmentNumber: "SH-2",
      customerName: "a",
      bagCount: 50,
      arrivedAt: "2026-10-01T00:00:00Z",
    }),
    record({
      shipmentNumber: "SH-3",
      customerName: "c",
      bagCount: 35,
      arrivedAt: "2026-10-02T00:00:00Z",
    }),
  ];

  describe("isInStorage", () => {
    it("keeps only the shipments whose grinding has not started", () => {
      expect(isInStorage(record({ status: "pending" }))).toBe(true);
    });

    it("drops shipments in grinding or completed", () => {
      expect(isInStorage(record({ status: "grinding" }))).toBe(false);
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

  describe("storedShipments", () => {
    it("keeps the shipments in storage of the project", () => {
      expect(numbers(storedShipments(mixed, "zouerate1"))).toEqual(["SH-10"]);
      expect(storedShipments(mixed, "sfariyat2")).toEqual([]);
    });

    it("covers every project when none is given", () => {
      expect(numbers(storedShipments(mixed))).toEqual(["SH-10", "SH-13"]);
    });
  });

  describe("shipmentsOfProject", () => {
    it("keeps every shipment of the project, whatever its status", () => {
      expect(numbers(shipmentsOfProject(mixed, "zouerate1"))).toEqual(["SH-10", "SH-11", "SH-12"]);
    });
  });

  describe("bagCount", () => {
    it("sums the bags", () => {
      expect(bagCount(records)).toBe(105);
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
          record({ shipmentNumber: "SH-4", customerName: "b", bagCount: 5 }),
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
      project: "zouerate1",
      status: "completed",
      source: "Chami",
      notes: "",
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
        numbers(filterShipments(records, { from: "2026-09-10", to: "2026-09-20", query: "" })),
      ).toEqual(["SH-1002", "SH-1001"]);
    });

    it("accepts an open-ended range", () => {
      expect(numbers(filterShipments(records, { from: "2026-09-15", to: "", query: "" }))).toEqual([
        "SH-1003",
        "SH-1002",
      ]);
      expect(numbers(filterShipments(records, { from: "", to: "2026-09-15", query: "" }))).toEqual([
        "SH-1001",
      ]);
    });

    it("ignores a date that is still being typed", () => {
      expect(filterShipments(records, { from: "12/09", to: "", query: "" })).toHaveLength(3);
    });

    it("combines the dates and the search", () => {
      expect(
        numbers(filterShipments(records, { from: "2026-09-01", to: "2026-10-31", query: "أحمد" })),
      ).toEqual(["SH-1003", "SH-1001"]);
    });
  });

  describe("matchesQuery", () => {
    const [first] = records;
    if (first === undefined) throw new Error("expected a record");

    it("finds a client by part of the name", () => {
      expect(matchesQuery(first, "ولد")).toBe(true);
    });

    it("finds a shipment by its number, ignoring case", () => {
      expect(matchesQuery(first, "sh-1001")).toBe(true);
    });

    it("finds a phone typed with or without spaces", () => {
      expect(matchesQuery(first, "4118")).toBe(true);
      expect(matchesQuery(first, "41 18 30")).toBe(true);
    });

    it("rejects an unrelated search", () => {
      expect(matchesQuery(first, "Fatima")).toBe(false);
    });
  });

  describe("isFilterActive", () => {
    it("is off for the empty filter and a blank search", () => {
      expect(isFilterActive(emptyHistoryFilter)).toBe(false);
      expect(isFilterActive({ from: "", to: "", query: "  " })).toBe(false);
    });

    it("is on as soon as one filter is set", () => {
      expect(isFilterActive({ from: "2026-09-01", to: "", query: "" })).toBe(true);
    });
  });
});

describe("transport cost", () => {
  describe("bagsCost", () => {
    it("charges the fare for every bag", () => {
      expect(bagsCost(10, 200)).toBe(2000);
    });

    it("is zero without a fare", () => {
      expect(bagsCost(10, 0)).toBe(0);
    });
  });

  describe("passengersCost", () => {
    it("charges the fare for every passenger", () => {
      expect(passengersCost(3, 500)).toBe(1500);
    });

    it("is zero without passengers", () => {
      expect(passengersCost(0, 500)).toBe(0);
    });
  });

  describe("transportTotal", () => {
    it("adds the bags and the passengers", () => {
      expect(
        transportTotal({ bagCount: 10, bagFare: 200, passengerCount: 2, passengerFare: 300 }),
      ).toBe(2600);
    });

    it("treats an empty or negative amount as zero while typing", () => {
      expect(
        transportTotal({
          bagCount: Number.NaN,
          bagFare: 200,
          passengerCount: 2,
          passengerFare: -5,
        }),
      ).toBe(0);
      expect(
        transportTotal({
          bagCount: 4,
          bagFare: 100,
          passengerCount: Number.NaN,
          passengerFare: 50,
        }),
      ).toBe(400);
    });
  });
});

describe("backend form", () => {
  const values: NewShipmentValues = {
    customerName: "Sidi Salem",
    phone: "46109325",
    arrivalDate: "2026-10-10",
    arrivalTime: "08:30",
    bagCount: 16,
    transportMethod: "hilux",
    source: " Chami ",
    bagFare: 200,
    passengerCount: 2,
    passengerFare: 50.5,
    mill: "3",
    status: "pending",
    notes: " Sacs mouillés ",
  };

  describe("shipmentToApi", () => {
    it("sends the fares in old ouguiya, the ids as numbers and trimmed texts", () => {
      expect(
        shipmentToApi(values, { customerId: "7", arrivedAt: "2026-10-10T08:30:00.000Z" }),
      ).toEqual({
        customer: 7,
        arrival_date: "2026-10-10T08:30:00.000Z",
        bags_count: 16,
        bag_transport_cost_per_bag: "2000",
        passengers_count: 2,
        passenger_transport_cost_per_person: "505",
        transport_method: "hilux",
        source: "Chami",
        project: 3,
        status: "pending",
        notes: "Sacs mouillés",
      });
    });
  });

  describe("shipmentErrorsFromApi", () => {
    it("puts the backend errors on our fields", () => {
      expect(
        shipmentErrorsFromApi({
          bags_count: "Trop petit.",
          project: "Projet inconnu.",
          number: "x",
        }),
      ).toEqual({ bagCount: "Trop petit.", mill: "Projet inconnu." });
    });
  });

  describe("isShipmentField", () => {
    it("knows the form fields only", () => {
      expect(isShipmentField("arrivalTime")).toBe(true);
      expect(isShipmentField("shipmentNumber")).toBe(false);
    });
  });
});
