import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import {
  API,
  apiEmployee,
  apiWithdrawal,
  cellsOf,
  money,
  openAt,
  serveEmployeeData,
  serveEmployees,
  serveProjects,
  server,
  text,
  viewOnly,
} from "./employeesTesting";

serveEmployees();

function detail(label: string) {
  return screen.getByText(label, { selector: "dt" }).nextSibling;
}

function rowsOf(title: string) {
  const panel = screen.getByText(title).closest("section");

  if (panel === null) {
    throw new Error(`${title} panel missing`);
  }

  return within(panel).getAllByRole("row").slice(1);
}

function serveSeven() {
  serveProjects([11]);
  serveEmployeeData(
    [apiEmployee(7)],
    [apiWithdrawal(4, { amount: "40000.00", notes: "Avance" }), apiWithdrawal(3)],
  );
}

function capture(method: "post" | "patch", path: string, answer = HttpResponse.json({})) {
  const sent: unknown[] = [];

  server.use(
    http[method](`${API}${path}`, async ({ request }) => {
      sent.push(await request.json());
      return answer;
    }),
  );

  return sent;
}

describe("one employee", () => {
  it("shows what the backend worked out, the salaries and the withdrawals", async () => {
    serveSeven();
    openAt("/fr/employees/7");

    expect(await screen.findByRole("heading", { name: "Sidi Ahmed" })).toBeVisible();
    expect(detail(text.fields.startedOn)).toHaveTextContent("01/01/2026 08:00");
    expect(detail(text.fields.endedOn)).toHaveTextContent("—");
    expect(detail(text.fields.accruedUntil)).toHaveTextContent("28/10/2026");
    expect(detail(text.fields.earned)).toHaveTextContent(money(395860.29));
    expect(detail(text.fields.withdrawn)).toHaveTextContent(money(60000));
    expect(detail(text.fields.accumulated)).toHaveTextContent(money(335860.29));
    expect(detail(text.fields.debt)).toHaveTextContent(money(0));
    expect(rowsOf(text.raises.title).map(cellsOf)).toEqual([
      ["01/01/2026", money(39999)],
      ["01/10/2026", money(40000)],
    ]);
    expect(
      rowsOf(text.withdrawals.title)
        .slice(0, -1)
        .map((row) => cellsOf(row).slice(0, 4)),
    ).toEqual([
      ["15/09/2026 10:30", money(40000), "Avance", "admin"],
      ["15/09/2026 10:30", money(20000), "—", "admin"],
    ]);
  });

  it("raises the salary from a date, and shows the backend's refusal on the date", async () => {
    serveSeven();
    const sent = capture(
      "post",
      "/employee-salaries/",
      HttpResponse.json({ effective_from: ["Après la date d'embauche."] }, { status: 400 }),
    );
    const user = userEvent.setup();
    openAt("/fr/employees/7?raise=1");

    const drawer = within(await screen.findByRole("dialog", { name: text.raises.newTitle }));
    expect(drawer.getByText(money(40000))).toBeVisible();
    await user.type(drawer.getByLabelText(text.raises.newSalary), "45000");
    await user.type(drawer.getByLabelText(text.raises.from), "01/01/2026");
    await user.click(drawer.getByRole("button", { name: text.raises.create }));

    expect(await drawer.findByText("Après la date d'embauche.")).toBeVisible();
    expect(sent).toEqual([{ employee: 7, monthly_salary: "45000", effective_from: "2026-01-01" }]);
  });

  it("records a withdrawal on a date, after refusing an amount of zero", async () => {
    serveSeven();
    const sent = capture("post", "/employee-withdrawals/");
    const user = userEvent.setup();
    openAt("/fr/employees/7?withdraw=1");

    const drawer = within(await screen.findByRole("dialog", { name: text.withdrawals.newTitle }));
    const amount = drawer.getByLabelText(text.fields.amount);
    await user.type(amount, "0");
    await user.click(drawer.getByRole("button", { name: text.withdrawals.create }));
    expect(await drawer.findByText(text.errors.amountInvalid)).toBeVisible();

    await user.clear(amount);
    await user.type(amount, "60000");
    await user.clear(drawer.getByLabelText(text.fields.date));
    await user.type(drawer.getByLabelText(text.fields.date), "20/10/2026");
    await user.clear(drawer.getByLabelText(text.fields.time));
    await user.type(drawer.getByLabelText(text.fields.time), "11:15");
    await user.type(drawer.getByLabelText(text.fields.note), "Avance");
    await user.click(drawer.getByRole("button", { name: text.withdrawals.create }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(sent).toEqual([
      {
        employee: 7,
        amount: "60000",
        withdrawal_date: "2026-10-20T11:15:00.000Z",
        notes: "Avance",
      },
    ]);
  });

  it("changes a withdrawal from its row, filled with what was recorded", async () => {
    serveSeven();
    const sent = capture("patch", "/employee-withdrawals/3/");
    const user = userEvent.setup();
    openAt("/fr/employees/7");

    await screen.findByText(text.withdrawals.title);
    const second = rowsOf(text.withdrawals.title)[1];
    await user.click(
      within(second ?? document.body).getByRole("link", { name: /^Modifier le retrait/ }),
    );

    const drawer = within(await screen.findByRole("dialog", { name: text.withdrawals.editTitle }));
    const amount = drawer.getByLabelText(text.fields.amount);
    expect(amount).toHaveValue(20000);
    expect(drawer.getByLabelText(text.fields.time)).toHaveValue("10:30");
    await user.clear(amount);
    await user.type(amount, "25000");
    await user.click(drawer.getByRole("button", { name: text.form.save }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(sent).toEqual([
      { amount: "25000", withdrawal_date: "2026-09-15T10:30:00.000Z", notes: "" },
    ]);
  });

  it("deletes the employee after confirming and goes back to the project", async () => {
    serveSeven();
    server.use(http.delete(`${API}/employees/7/`, () => new HttpResponse(null, { status: 204 })));
    const user = userEvent.setup();
    const router = openAt("/fr/employees/7");

    await user.click(await screen.findByRole("link", { name: text.delete }));
    const drawer = within(await screen.findByRole("dialog", { name: text.remove.title }));
    await user.click(drawer.getByRole("button", { name: text.remove.confirm }));

    await screen.findByRole("heading", { name: text.listTitle });
    expect(router.state.location.pathname).toBe("/fr/employees/projects/11");
  });

  it("deletes a withdrawal only after confirming", async () => {
    serveSeven();
    let deleted = false;
    server.use(
      http.delete(`${API}/employee-withdrawals/3/`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    openAt("/fr/employees/7?deleteWithdrawal=3");

    const drawer = within(
      await screen.findByRole("dialog", { name: text.withdrawals.removeTitle }),
    );
    expect(deleted).toBe(false);
    await user.click(drawer.getByRole("button", { name: text.remove.confirm }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(deleted).toBe(true);
  });

  it("offers no withdrawal, raise, edit or delete to a role that can only view", async () => {
    serveSeven();
    openAt("/fr/employees/7?raise=1", viewOnly);

    await screen.findByRole("heading", { name: "Sidi Ahmed" });
    expect(screen.queryByRole("link", { name: text.withdrawals.new })).toBeNull();
    expect(screen.queryByRole("link", { name: text.raises.new })).toBeNull();
    expect(screen.queryByRole("link", { name: text.edit })).toBeNull();
    expect(screen.queryByRole("link", { name: /^Supprimer/ })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
