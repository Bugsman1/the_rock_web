import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import {
  API,
  apiDebt,
  apiDebtPayment,
  apiEmployee,
  capture,
  cellsOf,
  money,
  openAt,
  openTab,
  rowsOf,
  serveEmployeeData,
  serveEmployeeRecords,
  serveEmployees,
  serveProjects,
  server,
  text,
  viewOnly,
} from "./employeesTesting";

serveEmployees();

const systemNote = "Dette payée automatiquement par le système sur le salaire.";

function serveDebts() {
  serveProjects([11]);
  serveEmployeeData([
    apiEmployee(7, { remaining_debt: "3000.00", remaining_other_debt: "3000.00" }),
  ]);
  serveEmployeeRecords({
    debts: [
      apiDebt(5),
      apiDebt(4, {
        amount: "8000.00",
        debt_date: "2026-09-20T15:30:00Z",
        description: "Téléphone",
        paid_by_salary: false,
      }),
    ],
    payments: [
      apiDebtPayment(6, { notes: "Espèces" }),
      apiDebtPayment(3, {
        amount: "15000.00",
        method: "salary",
        paid_at: "2026-10-03T00:00:00Z",
        notes: systemNote,
        created_by_name: null,
      }),
    ],
  });
}

describe("an employee's debts", () => {
  it("lists debts and payments together, newest first, with what is left to pay", async () => {
    serveDebts();
    openAt("/fr/employees/7");

    await openTab(text.tabs.debts);
    const rows = rowsOf(text.debts.title);
    expect(rows.slice(0, -1).map((row) => cellsOf(row).slice(0, 6))).toEqual([
      ["10/10/2026 12:00", text.debts.payment, "Espèces", text.debts.byHand, money(-5000), "admin"],
      ["03/10/2026 00:00", text.debts.payment, systemNote, text.debts.bySalary, money(-15000), "—"],
      [
        "02/10/2026 09:00",
        text.debts.debt,
        "Avance sur frais",
        text.debts.bySalary,
        money(15000),
        "admin",
      ],
      ["20/09/2026 15:30", text.debts.debt, "Téléphone", text.debts.byHand, money(8000), "admin"],
    ]);
    expect(rows.at(-1)).toHaveTextContent(`${text.debts.left}${money(3000)}`);
  });

  it("lets only the debts and the payments by hand be changed", async () => {
    serveDebts();
    openAt("/fr/employees/7");

    await openTab(text.tabs.debts);
    const [byHand, fromSalary, debt] = rowsOf(text.debts.title);
    expect(
      within(byHand ?? document.body).getByRole("link", { name: /^Modifier le paiement/ }),
    ).toBeVisible();
    expect(within(fromSalary ?? document.body).queryByRole("link")).toBeNull();
    expect(
      within(debt ?? document.body).getByRole("link", { name: /^Modifier la dette/ }),
    ).toBeVisible();
  });

  it("records a debt paid by the salary unless unticked", async () => {
    serveDebts();
    const sent = capture("post", "/employee-debts/");
    const user = userEvent.setup();
    openAt("/fr/employees/7");

    await user.click(await screen.findByRole("link", { name: text.debts.new }));
    const drawer = within(await screen.findByRole("dialog", { name: text.debts.newTitle }));
    const paidBySalary = drawer.getByLabelText(text.debts.paidBySalary);
    expect(paidBySalary).toBeChecked();
    await user.click(drawer.getByRole("button", { name: text.debts.create }));
    expect(await drawer.findByText(text.errors.amountInvalid)).toBeVisible();

    await user.type(drawer.getByLabelText(text.fields.amount), "12000");
    await user.clear(drawer.getByLabelText(text.fields.date));
    await user.type(drawer.getByLabelText(text.fields.date), "25/10/2026");
    await user.clear(drawer.getByLabelText(text.fields.time));
    await user.type(drawer.getByLabelText(text.fields.time), "08:45");
    await user.type(drawer.getByLabelText(text.fields.description), "Pneus");
    await user.click(paidBySalary);
    await user.click(drawer.getByRole("button", { name: text.debts.create }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(sent).toEqual([
      {
        employee: 7,
        amount: "12000",
        debt_date: "2026-10-25T08:45:00.000Z",
        description: "Pneus",
        paid_by_salary: false,
      },
    ]);
  });

  it("shows the backend's refusal to switch a debt already paid", async () => {
    serveDebts();
    capture(
      "patch",
      "/employee-debts/5/",
      HttpResponse.json(
        { paid_by_salary: ["Une partie de cette dette est déjà payée."] },
        { status: 400 },
      ),
    );
    const user = userEvent.setup();
    openAt("/fr/employees/7?debt=5");

    const drawer = within(await screen.findByRole("dialog", { name: text.debts.editTitle }));
    expect(drawer.getByLabelText(text.fields.amount)).toHaveValue(15000);
    await user.click(drawer.getByLabelText(text.debts.paidBySalary));
    await user.click(drawer.getByRole("button", { name: text.form.save }));

    expect(await drawer.findByText("Une partie de cette dette est déjà payée.")).toBeVisible();
  });

  it("records a payment by hand from the debts tab, and shows the backend's refusal", async () => {
    serveDebts();
    const sent = capture(
      "post",
      "/employee-debt-payments/",
      HttpResponse.json({ amount: ["Il ne reste que 3000.00 à payer."] }, { status: 400 }),
    );
    const user = userEvent.setup();
    openAt("/fr/employees/7");

    await openTab(text.tabs.debts);
    await user.click(screen.getByRole("link", { name: text.payments.new }));
    const drawer = within(await screen.findByRole("dialog", { name: text.payments.newTitle }));
    expect(drawer.getByText(money(3000))).toBeVisible();
    await user.type(drawer.getByLabelText(text.fields.amount), "4000");
    await user.clear(drawer.getByLabelText(text.fields.date));
    await user.type(drawer.getByLabelText(text.fields.date), "20/10/2026");
    await user.clear(drawer.getByLabelText(text.fields.time));
    await user.type(drawer.getByLabelText(text.fields.time), "10:00");
    await user.click(drawer.getByRole("button", { name: text.payments.create }));

    expect(await drawer.findByText("Il ne reste que 3000.00 à payer.")).toBeVisible();
    expect(sent).toEqual([
      { employee: 7, amount: "4000", paid_at: "2026-10-20T10:00:00.000Z", notes: "" },
    ]);
  });

  it("changes a payment by hand, and never opens one the system took", async () => {
    serveDebts();
    const sent = capture("patch", "/employee-debt-payments/6/");
    const user = userEvent.setup();
    openAt("/fr/employees/7?payment=6");

    const drawer = within(await screen.findByRole("dialog", { name: text.payments.editTitle }));
    expect(drawer.getByLabelText(text.fields.note)).toHaveValue("Espèces");
    await user.clear(drawer.getByLabelText(text.fields.amount));
    await user.type(drawer.getByLabelText(text.fields.amount), "2000");
    await user.click(drawer.getByRole("button", { name: text.form.save }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(sent).toEqual([
      { amount: "2000", paid_at: "2026-10-10T12:00:00.000Z", notes: "Espèces" },
    ]);
  });

  it("opens no drawer for a payment the system took from the salary", async () => {
    serveDebts();
    openAt("/fr/employees/7?payment=3");

    await screen.findByRole("heading", { name: "Sidi Ahmed" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("deletes a debt only after confirming, and shows the backend's reason when refused", async () => {
    serveDebts();
    server.use(
      http.delete(`${API}/employee-debts/4/`, () =>
        HttpResponse.json(["Cette dette est déjà payée."], { status: 400 }),
      ),
    );
    const user = userEvent.setup();
    openAt("/fr/employees/7?deleteDebt=4");

    const drawer = within(await screen.findByRole("dialog", { name: text.debts.removeTitle }));
    await user.click(drawer.getByRole("button", { name: text.remove.confirm }));

    expect(await drawer.findByText("Cette dette est déjà payée.")).toBeVisible();
  });

  it("offers no new debt, payment, edit or delete to a role that can only view", async () => {
    serveDebts();
    openAt("/fr/employees/7?debt=5", viewOnly);

    await openTab(text.tabs.debts);
    expect(screen.queryByRole("link", { name: text.debts.new })).toBeNull();
    expect(screen.queryByRole("link", { name: text.payments.new })).toBeNull();
    expect(screen.queryByRole("link", { name: /^Modifier/ })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
