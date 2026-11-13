import { describe, expect, it } from "vitest";
import {
  accountEntryFromApi,
  createDeliverySchema,
  createPaymentSchema,
  deliveryChangesToApi,
  deliveryErrorsFromApi,
  deliveryFromApi,
  newDeliveryToApi,
  paymentErrorsFromApi,
  paymentFromApi,
  paymentToApi,
} from "./supplierAccount";

const messages = {
  required: "required",
  dateInvalid: "date",
  timeInvalid: "time",
  amountInvalid: "amount",
  quantityInvalid: "quantity",
  priceInvalid: "price",
};

const stamps = { created_at: "2026-10-12T08:00:00Z", updated_at: "2026-10-12T08:00:00Z" };

const at = "2026-10-12T10:00:00.000Z";

const delivery = {
  resource: "2",
  quantity: 100,
  price: 300,
  date: "2026-10-12",
  time: "10:00",
  note: "Bidons",
};

function messagesOf(result: { error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  return Object.fromEntries(
    (result.error?.issues ?? []).map((issue) => [issue.path.join("."), issue.message]),
  );
}

describe("createPaymentSchema", () => {
  it("requires an amount above zero, a date and a time", () => {
    expect(
      messagesOf(
        createPaymentSchema(messages).safeParse({ amount: 0, date: "", time: "", note: "" }),
      ),
    ).toEqual({ amount: "amount", date: "required", time: "required" });
  });
});

describe("createDeliverySchema", () => {
  const schema = createDeliverySchema(messages);

  it("accepts a delivery given for free", () => {
    expect(schema.safeParse({ ...delivery, price: 0 }).success).toBe(true);
  });

  it("requires the resource, a quantity above zero and a price", () => {
    expect(
      messagesOf(schema.safeParse({ ...delivery, resource: "", quantity: 0, price: Number.NaN })),
    ).toEqual({ resource: "required", quantity: "quantity", price: "price" });
  });
});

describe("accountEntryFromApi", () => {
  it("reads a delivery with its resource, its quantity and the balance after it", () => {
    expect(
      accountEntryFromApi({
        type: "delivery",
        id: 4,
        date: at,
        amount: "300.00",
        resource: 2,
        resource_name: "mercury",
        quantity: "100.000",
        is_initial: false,
        notes: "",
        created_by_name: "Aicha",
        recorded_at: at,
        balance: "700.00",
      }),
    ).toEqual({
      key: "delivery-4",
      type: "delivery",
      id: "4",
      at,
      amount: 300,
      resource: { kind: "mercury", name: "mercury" },
      quantity: 100,
      isInitial: false,
      note: "",
      byName: "Aicha",
      balance: 700,
    });
  });

  it("reads a payment with no resource", () => {
    expect(
      accountEntryFromApi({
        type: "payment",
        id: 4,
        date: at,
        amount: "1000.00",
        resource: null,
        resource_name: null,
        quantity: null,
        is_initial: false,
        notes: "Avance",
        created_by_name: null,
        recorded_at: at,
        balance: "1000.00",
      }),
    ).toMatchObject({ key: "payment-4", resource: undefined, quantity: undefined, byName: null });
  });
});

describe("paymentFromApi", () => {
  it("reads the payment's amount, date and notes", () => {
    expect(
      paymentFromApi({
        id: 7,
        supplier: 5,
        supplier_name: "Sidi",
        amount: "1000.00",
        paid_at: at,
        notes: "Avance",
        created_by_name: "Aicha",
        ...stamps,
      }),
    ).toEqual({ id: "7", amount: 1000, at, note: "Avance" });
  });
});

describe("deliveryFromApi", () => {
  it("reads the delivery with its resource named by type", () => {
    expect(
      deliveryFromApi({
        id: 4,
        supplier: 5,
        supplier_name: "Sidi",
        resource: 2,
        resource_name: "mercury",
        is_stockable: true,
        project: 3,
        project_name: "Zouérat 1",
        quantity: "100.000",
        price: "300.00",
        delivered_at: at,
        notes: "",
        is_initial: true,
        created_by_name: "Aicha",
        ...stamps,
      }),
    ).toEqual({
      id: "4",
      resource: { id: "2", kind: "mercury", name: "mercury", projectName: "Zouérat 1" },
      quantity: 100,
      price: 300,
      at,
      note: "",
      isInitial: true,
    });
  });
});

describe("paymentToApi", () => {
  it("sends the amount as typed, the moment and the notes", () => {
    expect(
      paymentToApi({ amount: 1000, date: "2026-10-12", time: "10:00", note: "Avance" }, at),
    ).toEqual({ amount: "1000", paid_at: at, notes: "Avance" });
  });
});

describe("newDeliveryToApi", () => {
  it("sends the resource, the quantity and the price of the whole delivery", () => {
    expect(newDeliveryToApi(delivery, at)).toEqual({
      resource: 2,
      quantity: "100.000",
      price: "300",
      delivered_at: at,
      notes: "Bidons",
    });
  });
});

describe("deliveryChangesToApi", () => {
  it("never sends the resource, nor the quantity of an initial delivery", () => {
    expect(deliveryChangesToApi(delivery, at, false)).toEqual({
      quantity: "100.000",
      price: "300",
      delivered_at: at,
      notes: "Bidons",
    });
    expect(deliveryChangesToApi(delivery, at, true)).toEqual({
      price: "300",
      delivered_at: at,
      notes: "Bidons",
    });
  });
});

describe("errors from the backend", () => {
  it("puts a payment's errors on our fields", () => {
    expect(paymentErrorsFromApi({ amount: "Trop.", paid_at: "Futur." })).toEqual({
      amount: "Trop.",
      date: "Futur.",
    });
  });

  it("puts a delivery's errors on our fields", () => {
    expect(
      deliveryErrorsFromApi({
        resource: "Sans fournisseur.",
        quantity: "Utilisé.",
        delivered_at: "Futur.",
      }),
    ).toEqual({ resource: "Sans fournisseur.", quantity: "Utilisé.", date: "Futur." });
  });
});
