import { describe, expect, it } from "vitest";
import type { ApiSchema } from "@/lib/api/client";
import {
  createIncreaseSchema,
  createNewDebtSchema,
  createPaymentSchema,
  debtActions,
  debtFromApi,
  debtHistoryFromApi,
  increaseErrorsFromApi,
  increaseToApi,
  isDebtAction,
  newDebtErrorsFromApi,
  newDebtToApi,
  paymentErrorsFromApi,
  paymentToApi,
} from "./debts";

const apiDebt: ApiSchema<"CustomerDebt"> = {
  id: 12,
  customer: 7,
  customer_name: "Ahmed",
  customer_phone: "+22222411830",
  description: "Avance en espèces",
  incurred_at: "2026-10-01T08:00:00Z",
  original_amount: "50000.00",
  increased_amount: "10000.00",
  total_amount: "60000.00",
  paid_amount: "20000.00",
  remaining_amount: "40000.00",
  status: "partially_paid",
  approved_at: null,
  approved_by_name: null,
  increases: [
    { id: 3, amount: "10000.00", increased_at: "2026-10-05T09:00:00Z", reason: "Gasoil" },
  ],
  payments: [
    { id: 4, amount: "15000.00", paid_at: "2026-10-03T10:00:00Z", notes: "Premier versement" },
    { id: 5, amount: "5000.00", paid_at: "2026-10-08T10:00:00Z", notes: "" },
  ],
  created_by_name: "Sidi",
  created_at: "2026-10-01T08:00:00Z",
  updated_at: "2026-10-08T10:00:00Z",
};

const messages = {
  required: "required",
  amountInvalid: "amount",
  amountTooHigh: "too high",
};

function errorsOf(result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) {
  return Object.fromEntries(
    (result.error?.issues ?? []).map((issue) => [issue.path.join("."), issue.message]),
  );
}

describe("debtFromApi", () => {
  it("reads the amounts and status the backend computed", () => {
    expect(debtFromApi(apiDebt)).toMatchObject({
      id: "12",
      description: "Avance en espèces",
      total: 60000,
      paid: 20000,
      remaining: 40000,
      status: "partially_paid",
    });
  });

  it("reads each history line with the balance the backend computed after it", () => {
    expect(
      debtHistoryFromApi({
        type: "payment",
        id: 4,
        date: "2026-10-03T10:00:00Z",
        amount: "15000.00",
        text: "Premier versement",
        created_by_name: null,
        recorded_at: "2026-10-03T10:01:00Z",
        balance: "35000.00",
      }),
    ).toEqual({
      key: "payment-4",
      type: "payment",
      date: "2026-10-03T10:00:00Z",
      amount: 15000,
      text: "Premier versement",
      balance: 35000,
    });
  });

  it("offers every action on an open debt and only an increase on a paid one", () => {
    expect(debtActions(debtFromApi(apiDebt))).toEqual(["increase", "decrease", "payOff"]);
    expect(debtActions(debtFromApi({ ...apiDebt, status: "paid" }))).toEqual(["increase"]);
  });

  it("accepts only the known actions from the address", () => {
    expect(isDebtAction("payOff")).toBe(true);
    expect(isDebtAction("delete")).toBe(false);
    expect(isDebtAction(null)).toBe(false);
  });
});

describe("debt forms", () => {
  it("requires a description and an amount above zero for a new debt", () => {
    const schema = createNewDebtSchema(messages);

    expect(errorsOf(schema.safeParse({ description: " ", amount: 0 }))).toEqual({
      description: "required",
      amount: "amount",
    });
    expect(schema.safeParse({ description: "Pièces", amount: 1500 }).success).toBe(true);
  });

  it("requires a reason for an increase", () => {
    expect(errorsOf(createIncreaseSchema(messages).safeParse({ amount: 500, reason: "" }))).toEqual(
      { reason: "required" },
    );
  });

  it("refuses a payment above what is left, with optional notes", () => {
    const schema = createPaymentSchema(messages, 40000);

    expect(errorsOf(schema.safeParse({ amount: 40001, notes: "" }))).toEqual({
      amount: "too high",
    });
    expect(schema.safeParse({ amount: 40000, notes: "" }).success).toBe(true);
  });
});

describe("debt requests", () => {
  it("sends the amounts as typed, with no date so the backend records now", () => {
    expect(newDebtToApi("7", { description: " Pièces ", amount: 1500.5 })).toEqual({
      customer: 7,
      description: "Pièces",
      original_amount: "1500.5",
    });
    expect(increaseToApi("12", { amount: 200, reason: " Gasoil " })).toEqual({
      debt: 12,
      amount: "200",
      reason: "Gasoil",
    });
    expect(paymentToApi("12", { amount: 40000, notes: " Soldé " })).toEqual({
      debt: 12,
      amount: "40000",
      notes: "Soldé",
    });
  });

  it("puts the backend's refusals on the matching fields", () => {
    expect(newDebtErrorsFromApi({ original_amount: "Trop", description: "Vide" })).toEqual({
      amount: "Trop",
      description: "Vide",
    });
    expect(increaseErrorsFromApi({ amount: "Trop", debt: "Payée" })).toEqual({ amount: "Trop" });
    expect(paymentErrorsFromApi({ amount: "Trop", notes: "Long" })).toEqual({
      amount: "Trop",
      notes: "Long",
    });
  });
});
