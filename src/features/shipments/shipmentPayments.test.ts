import { describe, expect, it } from "vitest";
import type { ApiSchema } from "@/lib/api/client";
import {
  amountLeftToPay,
  isInProgress,
  shipmentFromApi,
  stageOf,
  totalBags,
} from "@/lib/shipments";
import { shipmentDetailFromApi, shipmentFormValues } from "./shipmentDetail";
import {
  amountLeftAfter,
  createDebtSchema,
  debtAfter,
  debtToApi,
  createPaymentSchema,
  paymentToApi,
  paymentErrorsFromApi,
} from "./shipmentPayments";

describe("shipment payments", () => {
  const apiShipment: ApiSchema<"Shipment"> = {
    id: 52,
    number: "SHP-00052",
    invoice_number: null,
    invoiced_at: null,
    customer: 4,
    customer_name: "Sidi",
    customer_phone: "+222 46 10 93 25",
    arrival_date: "2026-10-10T08:30:00Z",
    bags_count: 10,
    bag_transport_cost_per_bag: "300.00",
    passengers_count: 1,
    passenger_transport_cost_per_person: "200.00",
    unloading_cost_per_bag: null,
    unloading_total: "0.00",
    current_payment: "2200.00",
    debt: "0.00",
    debts: [],
    payments: [
      { id: 1, amount: "1000.00", paid_at: "2026-10-10T08:30:00Z", notes: "" },
      { id: 2, amount: "1200.00", paid_at: "2026-10-12T10:00:00Z", notes: "Deuxième" },
    ],
    transport_method: "truck",
    source: "Chami",
    project: 3,
    status: "pending",
    ground_bags: 0,
    refined_bags: 0,
    is_ground: false,
    is_refined: false,
    is_cancelled: false,
    cancelled_at: null,
    cancelled_by_name: "",
    cancellation_reason: "",
    notes: "",
    created_by_name: "med",
    created_at: "2026-10-10T08:30:00Z",
    updated_at: "2026-10-12T10:00:00Z",
  };

  it("is in progress until it is completed or cancelled", () => {
    expect(isInProgress(shipmentFromApi({ ...apiShipment, status: "pending" }))).toBe(true);
    expect(isInProgress(shipmentFromApi({ ...apiShipment, status: "grinding" }))).toBe(true);
    expect(isInProgress(shipmentFromApi({ ...apiShipment, status: "completed" }))).toBe(false);
    expect(isInProgress(shipmentFromApi({ ...apiShipment, status: "cancelled" }))).toBe(false);
  });

  it("keeps the test bags apart from the bags, and charges transport on both", () => {
    const record = shipmentFromApi({ ...apiShipment, bags_count: 8.5, test_bags_count: 1.5 });

    expect([record.bagCount, record.testBags, totalBags(record)]).toEqual([8.5, 1.5, 10]);
    expect(record.transportTotal).toBe(10 * 300 + 200);
    expect(shipmentFromApi({ ...apiShipment, test_bags_count: undefined }).testBags).toBe(0);
  });

  it("shows a shipment as refining once all its bags are ground, until the backend completes it", () => {
    expect(stageOf("pending", false)).toBe("pending");
    expect(stageOf("grinding", false)).toBe("grinding");
    expect(stageOf("grinding", true)).toBe("refining");
    expect(stageOf("completed", true)).toBe("completed");
    expect(stageOf("cancelled", false)).toBe("cancelled");
    expect(shipmentFromApi({ ...apiShipment, status: "cancelled" }).stage).toBe("cancelled");
    expect(shipmentFromApi({ ...apiShipment, status: "grinding", is_ground: true }).stage).toBe(
      "refining",
    );
    expect(shipmentFromApi({ ...apiShipment, status: "lost" }).status).toBe("pending");
  });

  it("adds a debt of its own to the shipment, with its reason", () => {
    const debtSchema = createDebtSchema({ amountInvalid: "amount" });

    expect(debtSchema.safeParse({ amount: 0, notes: "" }).success).toBe(false);
    expect(debtAfter(350, 150.5)).toBe(500.5);
    expect(debtAfter(350, Number.NaN)).toBe(350);
    expect(debtToApi("52", { amount: 150, notes: " Avance " })).toEqual({
      shipment: 52,
      amount: "150",
      description: "Avance",
    });
  });

  it("reads a shipment with its fares and its payments, oldest first", () => {
    const detail = shipmentDetailFromApi(apiShipment);

    expect(detail).toMatchObject({
      id: "52",
      transportTotal: 3200,
      paid: 2200,
      debt: 0,
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

  it("reads the unloading apart from the transport, and leaves it empty when there is none", () => {
    const unloaded = shipmentDetailFromApi({
      ...apiShipment,
      unloading_cost_per_bag: "40.00",
      unloading_total: "400.00",
    });

    expect(unloaded).toMatchObject({
      unloadingFare: 40,
      unloadingTotal: 400,
      transportTotal: 3200,
    });
    expect(amountLeftToPay(unloaded)).toBe(1000);
    expect(shipmentFormValues(unloaded).unloadingFare).toBe(40);
    expect(shipmentDetailFromApi(apiShipment).unloadingFare).toBeUndefined();
    expect(shipmentFormValues(shipmentDetailFromApi(apiShipment)).unloadingFare).toBeNaN();
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
