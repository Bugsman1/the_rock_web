import { describe, expect, it } from "vitest";
import {
  createEmployeeSchema,
  createRaiseSchema,
  createWithdrawalSchema,
  employeeCount,
  employeeErrorsFromApi,
  employeeFromApi,
  employeeToApi,
  isEmployeeField,
  isRaiseField,
  isWithdrawalField,
  monthlySalaryFromApi,
  newEmployeeToApi,
  raiseErrorsFromApi,
  raiseToApi,
  withdrawalErrorsFromApi,
  withdrawalFromApi,
  withdrawalToApi,
} from "./employees";
import { apiEmployee, apiMonthlySalary, apiWithdrawal } from "./employeesTesting";

const employeeSchema = createEmployeeSchema({
  required: "required",
  phoneInvalid: "phone",
  dateInvalid: "date",
  timeInvalid: "time",
  salaryInvalid: "salary",
  endBeforeStart: "endBeforeStart",
});

const validEmployee = {
  name: " Sidi ",
  job: "CHF",
  phone: "46109325",
  monthlySalary: 15000,
  startedOn: "2026-09-01",
  startTime: "08:30",
  endedOn: "",
};

function issues(result: { error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  return (result.error?.issues ?? []).map((issue) => [issue.path.join("."), issue.message]);
}

describe("employee form", () => {
  it("takes a complete employee, a job title from the list, and trims the texts", () => {
    expect(employeeSchema.parse(validEmployee)).toMatchObject({
      name: "Sidi",
      job: "CHF",
    });
  });

  it("needs every field but the end date, a listed job title, a valid phone, a salary above zero and real dates", () => {
    expect(
      issues(
        employeeSchema.safeParse({
          ...validEmployee,
          name: " ",
          job: "Chauffeur",
          phone: "12",
          monthlySalary: 0,
          startedOn: "2026-02-30",
          startTime: "25:00",
          endedOn: "2026-13-01",
        }),
      ),
    ).toEqual([
      ["name", "required"],
      ["job", "required"],
      ["phone", "phone"],
      ["monthlySalary", "salary"],
      ["startedOn", "date"],
      ["startTime", "time"],
      ["endedOn", "date"],
    ]);
  });

  it("refuses an end date before the start date", () => {
    expect(issues(employeeSchema.safeParse({ ...validEmployee, endedOn: "2026-08-31" }))).toEqual([
      ["endedOn", "endBeforeStart"],
    ]);
    expect(employeeSchema.safeParse({ ...validEmployee, endedOn: "2026-09-01" }).success).toBe(
      true,
    );
  });

  it("knows its fields", () => {
    expect(isEmployeeField("endedOn")).toBe(true);
    expect(isEmployeeField("matricule")).toBe(false);
    expect(isEmployeeField("balance")).toBe(false);
  });
});

describe("withdrawal and raise forms", () => {
  const withdrawalSchema = createWithdrawalSchema({
    required: "required",
    dateInvalid: "date",
    timeInvalid: "time",
    amountInvalid: "amount",
  });
  const raiseSchema = createRaiseSchema({
    required: "required",
    dateInvalid: "date",
    salaryInvalid: "salary",
  });

  it("takes a withdrawal above zero, whatever the employee is owed, on a real date", () => {
    expect(
      withdrawalSchema.safeParse({ amount: 9_999_999, date: "2026-10-01", time: "09:30", note: "" })
        .success,
    ).toBe(true);
    expect(
      issues(withdrawalSchema.safeParse({ amount: 0, date: "", time: "9h", note: "" })),
    ).toEqual([
      ["amount", "amount"],
      ["date", "required"],
      ["time", "time"],
    ]);
  });

  it("takes a raise with a new salary above zero and the date it starts", () => {
    expect(raiseSchema.safeParse({ monthlySalary: 40000, from: "2026-11-01" }).success).toBe(true);
    expect(issues(raiseSchema.safeParse({ monthlySalary: Number.NaN, from: "01/11" }))).toEqual([
      ["monthlySalary", "salary"],
      ["from", "date"],
    ]);
  });

  it("knows their fields", () => {
    expect(isWithdrawalField("date")).toBe(true);
    expect(isWithdrawalField("time")).toBe(true);
    expect(isRaiseField("from")).toBe(true);
    expect(isRaiseField("notes")).toBe(false);
  });
});

describe("employees from and to the backend", () => {
  it("reads the employee with the amounts the backend worked out", () => {
    expect(
      employeeFromApi(
        apiEmployee(7, {
          end_date: "2026-12-31",
          debt: "5000.5",
          absent_days: 3,
          remaining_debt: "9500.00",
          remaining_salary_debt: "7000.00",
          remaining_other_debt: "2500.00",
        }),
      ),
    ).toEqual({
      id: "7",
      project: "11",
      matricule: "EMP-7",
      name: "Sidi Ahmed",
      job: "CHF",
      phone: "+222 36 52 07 14",
      monthlySalary: 40000,
      salaries: [
        { id: "1", monthlySalary: 39999, from: "2026-01-01" },
        { id: "2", monthlySalary: 40000, from: "2026-10-01" },
      ],
      startedAt: "2026-01-01T08:00:00Z",
      endedOn: "2026-12-31",
      accruedUntil: "2026-10-28",
      absentDays: 3,
      earned: expect.closeTo(395860.29, 2),
      withdrawn: 60000,
      balance: expect.closeTo(335860.29, 2),
      accumulated: expect.closeTo(335860.29, 2),
      debt: 5000.5,
      debtLeft: 9500,
      salaryDebtLeft: 7000,
      otherDebtLeft: 2500,
    });
    expect(employeeFromApi(apiEmployee(7)).endedOn).toBeUndefined();
  });

  it("reads a month's salary with the month named by the backend", () => {
    expect(monthlySalaryFromApi(apiMonthlySalary(2))).toEqual({
      id: "2",
      monthName: "septembre 2026",
      amount: 40000,
      creditedOn: "2026-09-30",
    });
  });

  it("sends the salary only for a new employee, and no end date as null", () => {
    const values = employeeSchema.parse(validEmployee);

    expect(employeeToApi(values, "2026-09-01T08:30:00.000Z")).toEqual({
      full_name: "Sidi",
      job_title: "CHF",
      phone: "+22246109325",
      start_date: "2026-09-01T08:30:00.000Z",
      end_date: null,
    });
    expect(newEmployeeToApi("11", values, "2026-09-01T08:30:00.000Z")).toMatchObject({
      project: 11,
      monthly_salary: "15000",
    });
  });

  it("puts the backend's messages on the form's fields", () => {
    expect(
      employeeErrorsFromApi({ full_name: "n", job_title: "j", end_date: "e", start_date: "s" }),
    ).toEqual({ name: "n", job: "j", endedOn: "e", startedOn: "s" });
    expect(withdrawalErrorsFromApi({ withdrawal_date: "d", notes: "n" })).toEqual({
      date: "d",
      note: "n",
    });
    expect(raiseErrorsFromApi({ effective_from: "f", monthly_salary: "m" })).toEqual({
      from: "f",
      monthlySalary: "m",
    });
  });

  it("reads and sends withdrawals and raises", () => {
    expect(withdrawalFromApi(apiWithdrawal(3, { created_by_name: null }))).toEqual({
      id: "3",
      employee: "7",
      amount: 20000,
      at: "2026-09-15T10:30:00Z",
      note: "",
      byName: null,
    });
    expect(
      withdrawalToApi(
        { amount: 1500.255, date: "2026-10-01", time: "09:30", note: "Avance" },
        "2026-10-01T09:30:00.000Z",
      ),
    ).toEqual({
      amount: "1500.26",
      withdrawal_date: "2026-10-01T09:30:00.000Z",
      notes: "Avance",
    });
    expect(raiseToApi("7", { monthlySalary: 40000, from: "2026-11-01" })).toEqual({
      employee: 7,
      monthly_salary: "40000",
      effective_from: "2026-11-01",
    });
  });

  it("counts a project's employees", () => {
    const employees = [apiEmployee(1), apiEmployee(2), apiEmployee(3, { project: 12 })].map(
      employeeFromApi,
    );

    expect(employeeCount(employees, "11")).toBe(2);
    expect(employeeCount(employees, "13")).toBe(0);
  });
});
