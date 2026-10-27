import { describe, expect, it } from "vitest";
import { filledShipmentValues } from "./shipmentFormTesting";
import {
  bagsCost,
  isShipmentField,
  passengersCost,
  shipmentErrorsFromApi,
  shipmentToApi,
  newShipmentToApi,
  transportTotal,
  transportedBags,
  createNewShipmentSchema,
  remainingToPay,
} from "./shipments";

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
  const values = filledShipmentValues;

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
      passengerFareRequired: "fare required",
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

    it("takes a shipment with no passengers and sends them as zero", () => {
      const noPassengers = { ...values, passengerCount: Number.NaN, passengerFare: Number.NaN };

      expect(schema.safeParse(noPassengers).success).toBe(true);
      expect(
        shipmentToApi(noPassengers, { customerId: "7", arrivedAt: "2026-10-10T08:30:00.000Z" }),
      ).toMatchObject({ passengers_count: 0, passenger_transport_cost_per_person: "0" });
    });

    it("needs the fare per passenger as soon as the shipment has passengers", () => {
      const fareIssues = (passengerCount: number, passengerFare: number) =>
        (schema.safeParse({ ...values, passengerCount, passengerFare }).error?.issues ?? []).map(
          (issue) => [issue.path.join("."), issue.message],
        );

      expect(fareIssues(3, Number.NaN)).toEqual([["passengerFare", "fare required"]]);
      expect(fareIssues(3, 0)).toEqual([["passengerFare", "fare required"]]);
      expect(fareIssues(3, 500)).toEqual([]);
      expect(fareIssues(0, Number.NaN)).toEqual([]);
    });

    it("takes a debt of zero or more, apart from the transport, never sent with the shipment", () => {
      expect(
        (schema.safeParse({ ...values, debt: -1 }).error?.issues ?? []).map((issue) => [
          issue.path.join("."),
          issue.message,
        ]),
      ).toEqual([["debt", "amount"]]);
      expect(schema.safeParse({ ...values, debt: 50000 }).success).toBe(true);
      expect(
        shipmentToApi(values, { customerId: "7", arrivedAt: "2026-10-10T08:30:00.000Z" }),
      ).not.toHaveProperty("debt");
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
          passengerFareRequired: "fare required",
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

    it("counts the test bags in the transport, so moving bags to test keeps it paid", () => {
      const messages = {
        required: "required",
        bagCountInvalid: "bags",
        phoneInvalid: "phone",
        dateInvalid: "date",
        timeInvalid: "time",
        amountInvalid: "amount",
        passengerCountInvalid: "passengers",
        passengerFareRequired: "fare required",
        paymentTooHigh: "too high",
        totalBelowPaid: "below paid",
      };
      const edited = { ...values, bagCount: 10, currentPayment: Number.NaN };

      expect(createNewShipmentSchema(messages, 3000, 6).safeParse(edited).success).toBe(true);
      expect(createNewShipmentSchema(messages, 3000).safeParse(edited).success).toBe(false);
      expect(transportedBags(10, 6)).toBe(16);
      expect(transportedBags(Number.NaN, 1.5)).toBe(1.5);
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
