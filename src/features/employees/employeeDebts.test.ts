import { describe, expect, it } from "vitest";
import {
  createDebtSchema,
  debtErrorsFromApi,
  debtFromApi,
  debtLedger,
  debtPaymentErrorsFromApi,
  debtPaymentFromApi,
  debtPaymentToApi,
  debtToApi,
  isDebtField,
  isEnteredByHand,
} from "./employeeDebts";
import { apiDebt, apiDebtPayment } from "./employeesTesting";

const schema = createDebtSchema({
  required: "required",
  dateInvalid: "date",
  timeInvalid: "time",
  amountInvalid: "amount",
});

const validDebt = {
  amount: 15000,
  date: "2026-10-02",
  time: "09:00",
  description: " Avance ",
  paidBySalary: false,
};

function issues(result: { error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  return (result.error?.issues ?? []).map((issue) => [issue.path.join("."), issue.message]);
}

describe("debt form", () => {
  it("takes an amount above zero, a real date and time and a description", () => {
    expect(schema.parse(validDebt)).toMatchObject({ description: "Avance", paidBySalary: false });
    expect(
      issues(schema.safeParse({ ...validDebt, amount: 0, date: "", time: "9h", description: " " })),
    ).toEqual([
      ["amount", "amount"],
      ["date", "required"],
      ["time", "time"],
      ["description", "required"],
    ]);
  });

  it("knows its fields", () => {
    expect(isDebtField("paidBySalary")).toBe(true);
    expect(isDebtField("employee")).toBe(false);
  });
});

describe("debt ledger", () => {
  it("puts debts and payments in one list, newest first", () => {
    const debt = debtFromApi(apiDebt(5, { debt_date: "2026-10-02T09:00:00Z" }));
    const older = debtFromApi(apiDebt(4, { debt_date: "2026-09-20T15:30:00Z" }));
    const payment = debtPaymentFromApi(apiDebtPayment(6, { paid_at: "2026-10-10T12:00:00Z" }));

    expect(debtLedger([debt, older], [payment]).map((entry) => entry.id)).toEqual([
      "payment-6",
      "debt-5",
      "debt-4",
    ]);
    expect(debtLedger([], [])).toEqual([]);
  });
});

describe("debts and payments from and to the backend", () => {
  it("reads a debt and how it is paid back", () => {
    expect(debtFromApi(apiDebt(5))).toEqual({
      id: "5",
      amount: 15000,
      at: "2026-10-02T09:00:00Z",
      description: "Avance sur frais",
      paidBySalary: true,
      byName: "admin",
    });
  });

  it("sends a debt with its moment and whether the salary pays it", () => {
    expect(debtToApi(schema.parse(validDebt), "2026-10-02T09:00:00.000Z")).toEqual({
      amount: "15000",
      debt_date: "2026-10-02T09:00:00.000Z",
      description: "Avance",
      paid_by_salary: false,
    });
  });

  it("tells a payment entered by hand from one the system took from the salary", () => {
    const byHand = debtPaymentFromApi(apiDebtPayment(6));
    const fromSalary = debtPaymentFromApi(
      apiDebtPayment(7, { method: "salary", created_by_name: null }),
    );

    expect(byHand).toEqual({
      id: "6",
      amount: 5000,
      at: "2026-10-10T12:00:00Z",
      method: "other",
      note: "",
      byName: "admin",
    });
    expect(isEnteredByHand(byHand)).toBe(true);
    expect(isEnteredByHand(fromSalary)).toBe(false);
  });

  it("sends a payment with its moment and note", () => {
    expect(
      debtPaymentToApi(
        { amount: 2500, date: "2026-10-10", time: "12:00", note: "Espèces" },
        "2026-10-10T12:00:00.000Z",
      ),
    ).toEqual({ amount: "2500", paid_at: "2026-10-10T12:00:00.000Z", notes: "Espèces" });
  });

  it("puts the backend's messages on the form's fields", () => {
    expect(
      debtErrorsFromApi({ paid_by_salary: "Déjà payée", debt_date: "Avant l'embauche" }),
    ).toEqual({ paidBySalary: "Déjà payée", date: "Avant l'embauche" });
    expect(debtPaymentErrorsFromApi({ amount: "Reste 2500", paid_at: "Futur" })).toEqual({
      amount: "Reste 2500",
      date: "Futur",
    });
  });
});
