import { describe, expect, it } from "vitest";
import {
  createRaiseSchema,
  isRaiseField,
  raiseErrorsFromApi,
  raiseToApi,
  refiningCostToApi,
} from "./employeePay";

const raiseSchema = createRaiseSchema({
  required: "required",
  dateInvalid: "date",
  amountInvalid: "amount",
});

describe("raise and refining cost form", () => {
  it("takes a new amount above zero and the date it starts", () => {
    expect(raiseSchema.safeParse({ amount: 40000, from: "2026-11-01" }).success).toBe(true);
    expect(
      raiseSchema
        .safeParse({ amount: Number.NaN, from: "01/11" })
        .error?.issues.map((issue) => [issue.path.join("."), issue.message]),
    ).toEqual([
      ["amount", "amount"],
      ["from", "date"],
    ]);
  });

  it("knows its fields", () => {
    expect(isRaiseField("from")).toBe(true);
    expect(isRaiseField("notes")).toBe(false);
  });

  it("sends a raise as a monthly salary and a gold refiner's change as a cost per gram", () => {
    const values = { amount: 45, from: "2026-11-01" };

    expect(raiseToApi("7", values)).toEqual({
      employee: 7,
      monthly_salary: "45",
      effective_from: "2026-11-01",
    });
    expect(refiningCostToApi("9", values)).toEqual({
      employee: 9,
      cost_per_gram: "45",
      effective_from: "2026-11-01",
    });
  });

  it("puts the backend's messages on the amount and the date", () => {
    expect(raiseErrorsFromApi({ effective_from: "f", monthly_salary: "m" })).toEqual({
      from: "f",
      amount: "m",
    });
    expect(raiseErrorsFromApi({ cost_per_gram: "c" })).toEqual({ amount: "c" });
  });
});
