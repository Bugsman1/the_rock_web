import { describe, expect, it } from "vitest";
import {
  addWithdrawal,
  createEmployee,
  deleteEmployee,
  deleteWithdrawal,
  getEmployee,
  getEmployees,
  getWithdrawals,
  updateEmployee,
  updateWithdrawal,
} from "./employeesApi";

const withdrawal = { amount: 1000, date: "2026-10-20", time: "10:00", note: " Avance " };

describe("placeholder employees", () => {
  it("gives every project its sample employees, owed or owing", async () => {
    const employees = await getEmployees(["31"]);

    expect(
      employees.map((employee) => [employee.id, employee.matricule, employee.balance]),
    ).toEqual([
      ["3101", "EMP-001", 218000],
      ["3102", "EMP-002", 49000],
      ["3103", "EMP-003", -6000],
    ]);
    expect((await getEmployee("3103"))?.name).toBe("أحمد ولد إبراهيم");
    expect(await getEmployee("abc")).toBeUndefined();
  });

  it("lists the withdrawals newest first and counts them in the balance", async () => {
    await getEmployees(["32"]);
    await addWithdrawal("3202", withdrawal, "2026-10-20T10:00:00.000Z");

    const withdrawals = await getWithdrawals("3202");
    expect(withdrawals.map((item) => [item.amount, item.note])).toEqual([
      [1000, "Avance"],
      [20000, ""],
      [20000, ""],
    ]);
    expect((await getEmployee("3202"))?.balance).toBe(48000);

    const added = withdrawals[0];
    if (added === undefined) {
      throw new Error("withdrawal missing");
    }

    await updateWithdrawal(added.id, { ...withdrawal, amount: 4000 }, added.at);
    expect((await getEmployee("3202"))?.balance).toBe(45000);

    await deleteWithdrawal(added.id);
    expect((await getEmployee("3202"))?.balance).toBe(49000);
  });

  it("adds, changes and deletes an employee", async () => {
    const values = {
      matricule: "EMP-9",
      name: "Sidi",
      job: "refiner" as const,
      phone: "46109325",
      monthlySalary: 15000,
      startedOn: "2026-10-01",
    };
    const created = await createEmployee("33", values);

    expect(created.ok).toBe(true);
    const id = created.ok ? created.id : "";
    expect(await getEmployee(id)).toMatchObject({ phone: "+222 46 10 93 25", balance: 0 });

    await updateEmployee(id, { ...values, name: "Sidi Mohamed" });
    expect((await getEmployee(id))?.name).toBe("Sidi Mohamed");

    expect(await deleteEmployee(id)).toEqual({ ok: true });
    expect(await getEmployee(id)).toBeUndefined();
    expect(await deleteEmployee(id)).toEqual({ ok: false });
  });
});
