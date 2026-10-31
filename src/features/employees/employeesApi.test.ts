import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { EmployeeValues } from "./employees";
import {
  addRaise,
  addWithdrawal,
  createEmployee,
  deleteEmployee,
  getEmployee,
  getEmployees,
  getWithdrawals,
  updateEmployee,
  updateWithdrawal,
} from "./employeesApi";
import {
  API,
  apiEmployee,
  apiWithdrawal,
  serveEmployeeData,
  serveEmployees,
  server,
} from "./employeesTesting";

serveEmployees();

const values: EmployeeValues = {
  name: "Sidi",
  job: "CHF",
  phone: "46109325",
  monthlySalary: 15000,
  startedOn: "2026-10-01",
  startTime: "08:30",
  endedOn: "",
};

const startedAt = "2026-10-01T08:30:00.000Z";

function capture(method: "post" | "patch", path: string, answer = HttpResponse.json({})) {
  const sent: { body: unknown; key: string | null }[] = [];

  server.use(
    http[method](`${API}${path}`, async ({ request }) => {
      sent.push({ body: await request.json(), key: request.headers.get("Idempotency-Key") });
      return answer;
    }),
  );

  return sent;
}

describe("employees API", () => {
  it("lists a project's employees, finds one and its withdrawals", async () => {
    serveEmployeeData(
      [apiEmployee(7), apiEmployee(8, { project: 12 })],
      [apiWithdrawal(3), apiWithdrawal(4, { employee: 8 })],
    );

    expect((await getEmployees("11")).map((employee) => employee.id)).toEqual(["7"]);
    expect(await getEmployees()).toHaveLength(2);
    expect((await getEmployee("8"))?.project).toBe("12");
    expect(await getEmployee("9")).toBeUndefined();
    expect(await getEmployee("abc")).toBeUndefined();
    expect((await getWithdrawals("7")).map((withdrawal) => withdrawal.id)).toEqual(["3"]);
  });

  it("creates an employee with their starting salary, once per key", async () => {
    const sent = capture("post", "/employees/");

    expect(await createEmployee("11", values, startedAt, "key-1")).toEqual({ ok: true });
    expect(sent).toEqual([
      {
        key: "key-1",
        body: {
          full_name: "Sidi",
          job_title: "CHF",
          phone: "+22246109325",
          start_date: startedAt,
          end_date: null,
          project: 11,
          monthly_salary: "15000",
        },
      },
    ]);
  });

  it("changes an employee without sending the salary, and shows the backend's refusals", async () => {
    const sent = capture(
      "patch",
      "/employees/7/",
      HttpResponse.json({ start_date: ["Après le premier retrait."] }, { status: 400 }),
    );

    expect(await updateEmployee("7", { ...values, endedOn: "2026-12-31" }, startedAt)).toEqual({
      ok: false,
      fieldErrors: { startedOn: "Après le premier retrait." },
      failed: false,
    });
    expect(sent[0]?.body).toMatchObject({ end_date: "2026-12-31" });
    expect(sent[0]?.body).not.toHaveProperty("monthly_salary");
  });

  it("gives the backend's reason when it refuses a delete", async () => {
    server.use(
      http.delete(`${API}/employees/7/`, () =>
        HttpResponse.json(["Un employé qui a des retraits ne peut pas être supprimé."], {
          status: 400,
        }),
      ),
      http.delete(`${API}/employees/8/`, () => new HttpResponse(null, { status: 204 })),
    );

    expect(await deleteEmployee("7")).toEqual({
      ok: false,
      reason: "Un employé qui a des retraits ne peut pas être supprimé.",
    });
    expect(await deleteEmployee("8")).toEqual({ ok: true });
  });

  it("records a raise and a withdrawal, and changes a withdrawal", async () => {
    const raises = capture("post", "/employee-salaries/");
    const withdrawals = capture("post", "/employee-withdrawals/");
    const changes = capture("patch", "/employee-withdrawals/3/");
    const withdrawal = { amount: 5000, date: "2026-10-20", time: "11:15", note: "Avance" };
    const at = "2026-10-20T11:15:00.000Z";

    await addRaise("7", { monthlySalary: 40000, from: "2026-11-01" }, "key-2");
    await addWithdrawal("7", withdrawal, at, "key-3");
    await updateWithdrawal("3", { ...withdrawal, amount: 6000 }, at);

    expect(raises).toEqual([
      {
        key: "key-2",
        body: { employee: 7, monthly_salary: "40000", effective_from: "2026-11-01" },
      },
    ]);
    expect(withdrawals).toEqual([
      {
        key: "key-3",
        body: { employee: 7, amount: "5000", withdrawal_date: at, notes: "Avance" },
      },
    ]);
    expect(changes[0]?.body).toEqual({
      amount: "6000",
      withdrawal_date: at,
      notes: "Avance",
    });
  });
});
