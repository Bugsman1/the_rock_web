import { describe, expect, it } from "vitest";
import {
  createEmployeeSchema,
  createWithdrawalSchema,
  isEmployeeField,
  isWithdrawalField,
  projectEmployeesSummary,
} from "./employees";
import type { Employee } from "./employees";

const employeeSchema = createEmployeeSchema({
  required: "required",
  phoneInvalid: "phone",
  dateInvalid: "date",
  salaryInvalid: "salary",
});

const validEmployee = {
  matricule: " EMP-9 ",
  name: " Sidi ",
  job: "refiner",
  phone: "46109325",
  monthlySalary: 15000,
  startedOn: "2026-09-01",
};

function issues(result: { error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  return (result.error?.issues ?? []).map((issue) => [issue.path.join("."), issue.message]);
}

describe("employee form", () => {
  it("takes a complete employee and trims the texts", () => {
    expect(employeeSchema.parse(validEmployee)).toMatchObject({ matricule: "EMP-9", name: "Sidi" });
  });

  it("needs every field, a valid phone, a salary above zero and a real date", () => {
    expect(
      issues(
        employeeSchema.safeParse({
          ...validEmployee,
          matricule: "",
          phone: "12",
          monthlySalary: 0,
          startedOn: "2026-02-30",
        }),
      ),
    ).toEqual([
      ["matricule", "required"],
      ["phone", "phone"],
      ["monthlySalary", "salary"],
      ["startedOn", "date"],
    ]);
  });

  it("offers only the three jobs", () => {
    expect(issues(employeeSchema.safeParse({ ...validEmployee, job: "driver" }))).toEqual([
      ["job", "required"],
    ]);
  });

  it("knows its fields", () => {
    expect(isEmployeeField("matricule")).toBe(true);
    expect(isEmployeeField("balance")).toBe(false);
  });
});

describe("withdrawal form", () => {
  const schema = createWithdrawalSchema({
    required: "required",
    dateInvalid: "date",
    timeInvalid: "time",
    amountInvalid: "amount",
  });
  const valid = { amount: 5000, date: "2026-10-01", time: "09:30", note: "" };

  it("takes an amount above zero, whatever the employee is owed", () => {
    expect(schema.safeParse({ ...valid, amount: 9_999_999 }).success).toBe(true);
    expect(issues(schema.safeParse({ ...valid, amount: 0 }))).toEqual([["amount", "amount"]]);
    expect(issues(schema.safeParse({ ...valid, amount: Number.NaN }))).toEqual([
      ["amount", "amount"],
    ]);
  });

  it("needs a date and a time", () => {
    expect(issues(schema.safeParse({ ...valid, date: "", time: "25:00" }))).toEqual([
      ["date", "required"],
      ["time", "time"],
    ]);
  });

  it("knows its fields", () => {
    expect(isWithdrawalField("note")).toBe(true);
    expect(isWithdrawalField("employee")).toBe(false);
  });
});

describe("projectEmployeesSummary", () => {
  const employee = (project: string, balance: number): Employee => ({
    id: `${project}-${balance}`,
    project,
    matricule: "M",
    name: "N",
    job: "manager",
    phone: "",
    monthlySalary: 0,
    startedOn: "2026-01-01",
    earned: 0,
    withdrawn: 0,
    balance,
  });

  it("counts the project's employees and adds what they are owed, debts included", () => {
    expect(
      projectEmployeesSummary(
        [employee("3", 5000), employee("3", -2000), employee("4", 9000)],
        "3",
      ),
    ).toEqual({ count: 2, owed: 3000 });
  });
});
