import { describe, expect, it } from "vitest";
import type { ApiSchema } from "@/lib/api/client";
import type { MillingOperation } from "@/lib/grinding";
import { amountLeftToPay } from "@/lib/shipments";
import type { ShipmentRecord } from "@/lib/shipments";
import {
  amountLeftAfter,
  completedShipments,
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
  newShipmentToApi,
  shipmentDetailFromApi,
  shipmentFormValues,
  createPaymentSchema,
  paymentToApi,
  paymentErrorsFromApi,
  shipmentsByArrival,
  shipmentsOfProject,
  storedShipments,
  topClientsByBags,
  transportTotal,
  createNewShipmentSchema,
  remainingToPay,
  invoiceFileName,
} from "./shipments";
import type { NewShipmentValues, StoredShipment } from "./shipments";

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
      transportTotal: 0,
      paid: 0,
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
      transportTotal: 0,
      paid: 0,
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
    currentPayment: 1000.5,
    mill: "3",
    notes: " Sacs mouillés ",
  };

  describe("shipmentToApi", () => {
    it("sends the fares as typed, the ids as numbers and trimmed texts, and no status", () => {
      expect(
        newShipmentToApi(values, { customerId: "7", arrivedAt: "2026-10-10T08:30:00.000Z" }),
      ).toEqual({
        customer: 7,
        arrival_date: "2026-10-10T08:30:00.000Z",
        bags_count: 16,
        bag_transport_cost_per_bag: "200",
        passengers_count: 2,
        passenger_transport_cost_per_person: "50.5",
        current_payment: "1000.5",
        transport_method: "hilux",
        source: "Chami",
        project: 3,
        notes: "Sacs mouillés",
      });
    });

    it("sends no payment when an existing shipment is edited", () => {
      expect(
        shipmentToApi(values, { customerId: "7", arrivedAt: "2026-10-10T08:30:00.000Z" }),
      ).not.toHaveProperty("current_payment");
    });
  });

  describe("current payment", () => {
    const schema = createNewShipmentSchema({
      required: "required",
      bagCountInvalid: "bags",
      phoneInvalid: "phone",
      dateInvalid: "date",
      timeInvalid: "time",
      amountInvalid: "amount",
      passengerCountInvalid: "passengers",
      paymentTooHigh: "too high",
      totalBelowPaid: "below paid",
    });
    const issues = (currentPayment: number) =>
      (schema.safeParse({ ...values, phone: "46109325", currentPayment }).error?.issues ?? []).map(
        (issue) => [issue.path.join("."), issue.message],
      );

    it("takes whole or half bags, never another fraction", () => {
      const bagIssues = (bagCount: number) =>
        (
          schema.safeParse({ ...values, bagCount, currentPayment: Number.NaN }).error?.issues ?? []
        ).map((issue) => issue.message);

      expect(bagIssues(12.5)).toEqual([]);
      expect(bagIssues(0.5)).toEqual([]);
      expect(bagIssues(12.3)).toEqual(["bags"]);
      expect(bagIssues(0)).toEqual(["bags"]);
    });

    it("may stay empty and is sent as zero", () => {
      expect(issues(Number.NaN)).toEqual([]);
      expect(
        newShipmentToApi(
          { ...values, currentPayment: Number.NaN },
          { customerId: "7", arrivedAt: "2026-10-10T08:30:00.000Z" },
        ).current_payment,
      ).toBe("0");
    });

    it("is never negative nor more than the transport total", () => {
      expect(issues(-1)).toEqual([["currentPayment", "amount"]]);
      expect(issues(3302)).toEqual([["currentPayment", "too high"]]);
      expect(issues(3301)).toEqual([]);
    });

    it("keeps the transport total at or above what was already paid", () => {
      const editSchema = createNewShipmentSchema(
        {
          required: "required",
          bagCountInvalid: "bags",
          phoneInvalid: "phone",
          dateInvalid: "date",
          timeInvalid: "time",
          amountInvalid: "amount",
          passengerCountInvalid: "passengers",
          paymentTooHigh: "too high",
          totalBelowPaid: "below paid",
        },
        3000,
      );
      const edited = { ...values, currentPayment: Number.NaN };

      expect(editSchema.safeParse(edited).success).toBe(true);
      expect(
        editSchema
          .safeParse({ ...edited, bagCount: 10 })
          .error?.issues.map((issue) => [issue.path.join("."), issue.message]),
      ).toEqual([["bagFare", "below paid"]]);
    });

    it("leaves the rest of the transport total to pay", () => {
      expect(remainingToPay(3301, 1000.5)).toBe(2300.5);
      expect(remainingToPay(3301, Number.NaN)).toBe(3301);
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

describe("invoiceFileName", () => {
  it("reads the invoice number the backend names the file with", () => {
    expect(invoiceFileName('attachment; filename="FAC-2026-0007.pdf"')).toBe("FAC-2026-0007.pdf");
  });

  it("gives nothing when the backend sends no file name", () => {
    expect(invoiceFileName(null)).toBeUndefined();
    expect(invoiceFileName("attachment")).toBeUndefined();
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
    project: "3",
    status: "completed",
    source: "Chami",
    notes: "",
    transportTotal: 1000,
    paid: 400,
  };

  it("gives what is left to pay on a shipment, rounded to the cent", () => {
    expect(amountLeftToPay(base)).toBe(600);
    expect(amountLeftToPay({ ...base, transportTotal: 0.3, paid: 0.1 + 0.2 })).toBe(0);
    expect(amountLeftToPay({ ...base, paid: 1200 })).toBe(0);
  });

  it("keeps only the completed shipments", () => {
    const records: ShipmentRecord[] = [
      base,
      { ...base, id: "2", status: "pending" },
      { ...base, id: "3", status: "grinding" },
    ];

    expect(completedShipments(records).map((record) => record.id)).toEqual(["1"]);
  });
});

describe("shipment payments", () => {
  const apiShipment: ApiSchema<"Shipment"> = {
    id: 52,
    number: "SHP-00052",
    invoice_number: null,
    invoiced_at: null,
    customer_name: "Sidi",
    customer_phone: "+222 46 10 93 25",
    arrival_date: "2026-10-10T08:30:00Z",
    bags_count: 10,
    bag_transport_cost_per_bag: "300.00",
    passengers_count: 1,
    passenger_transport_cost_per_person: "200.00",
    current_payment: "2200.00",
    payments: [
      { id: 1, amount: "1000.00", paid_at: "2026-10-10T08:30:00Z", notes: "" },
      { id: 2, amount: "1200.00", paid_at: "2026-10-12T10:00:00Z", notes: "Deuxième" },
    ],
    transport_method: "truck",
    source: "Chami",
    project: 3,
    status: "pending",
    notes: "",
    created_by_name: "med",
    created_at: "2026-10-10T08:30:00Z",
    updated_at: "2026-10-12T10:00:00Z",
  };

  it("reads a shipment with its fares and its payments, oldest first", () => {
    const detail = shipmentDetailFromApi(apiShipment);

    expect(detail).toMatchObject({
      id: "52",
      transportTotal: 3200,
      paid: 2200,
      bagFare: 300,
      passengerCount: 1,
      passengerFare: 200,
      transportMethod: "truck",
    });
    expect(detail.payments).toEqual([
      { id: "1", amount: 1000, paidAt: "2026-10-10T08:30:00Z", notes: "" },
      { id: "2", amount: 1200, paidAt: "2026-10-12T10:00:00Z", notes: "Deuxième" },
    ]);
    expect(amountLeftToPay(detail)).toBe(1000);
  });

  it("fills the edit form from the shipment, with no payment to type", () => {
    expect(shipmentFormValues(shipmentDetailFromApi(apiShipment))).toMatchObject({
      customerName: "Sidi",
      arrivalDate: "2026-10-10",
      arrivalTime: "08:30",
      bagCount: 10,
      bagFare: 300,
      mill: "3",
      currentPayment: Number.NaN,
    });
  });

  const paymentSchema = createPaymentSchema(
    {
      required: "required",
      dateInvalid: "date",
      timeInvalid: "time",
      amountInvalid: "amount",
      amountTooHigh: "too high",
    },
    1000,
  );
  const payment = { amount: 1000, date: "2026-10-13", time: "09:00", notes: "" };

  it("gives what will be left after a payment, only for a payment that fits", () => {
    expect(amountLeftAfter(2200, 1200)).toBe(1000);
    expect(amountLeftAfter(2200, 2200)).toBe(0);
    expect(amountLeftAfter(0.3, 0.1)).toBe(0.2);
    expect(amountLeftAfter(2200, 2500)).toBeUndefined();
    expect(amountLeftAfter(2200, Number.NaN)).toBeUndefined();
  });

  it("takes a payment above zero and up to what is left to pay", () => {
    expect(paymentSchema.safeParse(payment).success).toBe(true);
    expect(paymentSchema.safeParse({ ...payment, amount: 0 }).error?.issues[0]?.message).toBe(
      "amount",
    );
    expect(paymentSchema.safeParse({ ...payment, amount: 1000.5 }).error?.issues[0]?.message).toBe(
      "too high",
    );
  });

  it("sends a payment with its shipment and its date, and reads the backend's refusals", () => {
    expect(
      paymentToApi(
        { ...payment, amount: 1200.5, notes: "Reste" },
        "52",
        "2026-10-13T09:00:00.000Z",
      ),
    ).toEqual({
      shipment: 52,
      amount: "1200.5",
      paid_at: "2026-10-13T09:00:00.000Z",
      notes: "Reste",
    });
    expect(paymentErrorsFromApi({ shipment: "Entièrement payée." })).toEqual({
      amount: "Entièrement payée.",
    });
    expect(paymentErrorsFromApi({ amount: "Trop élevé.", paid_at: "Date invalide." })).toEqual({
      amount: "Trop élevé.",
      date: "Date invalide.",
    });
  });
});
