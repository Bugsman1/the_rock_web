import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { cellsOf, money, openAt, serveEmployees, serveProjects, text } from "./employeesTesting";

serveEmployees();

function detail(label: string) {
  return screen.getByText(label, { selector: "dt" }).nextSibling;
}

function withdrawalRows() {
  const panel = screen.getByText(text.withdrawals.title).closest("section");

  if (panel === null) {
    throw new Error("withdrawals panel missing");
  }

  return within(panel).getAllByRole("row").slice(1, -1);
}

describe("one employee", () => {
  it("shows what was earned, withdrawn and is owed, and every withdrawal newest first", async () => {
    serveProjects([21]);
    openAt("/fr/employees/2101");

    expect(await screen.findByRole("heading", { name: "محمد ولد سيدي" })).toBeVisible();
    expect(detail(text.fields.earned)).toHaveTextContent(money(293000));
    expect(detail(text.fields.withdrawn)).toHaveTextContent(money(75000));
    expect(detail(text.fields.balance)).toHaveTextContent(money(218000));
    expect(withdrawalRows().map((row) => cellsOf(row)[2])).toEqual([
      "سلفة",
      "راتب فبراير",
      "راتب يناير",
    ]);
  });

  it("shows a debt with a minus when more was withdrawn than earned", async () => {
    serveProjects([22]);
    openAt("/fr/employees/2203");

    await screen.findByRole("heading", { name: "أحمد ولد إبراهيم" });
    expect(detail(text.fields.balance)).toHaveTextContent(money(-6000));
  });

  it("records a withdrawal, after refusing an amount of zero", async () => {
    serveProjects([23]);
    const user = userEvent.setup();
    openAt("/fr/employees/2302?withdraw=1");

    const drawer = within(await screen.findByRole("dialog", { name: text.withdrawals.newTitle }));
    const amount = drawer.getByLabelText(text.fields.amount);
    await user.type(amount, "0");
    await user.click(drawer.getByRole("button", { name: text.withdrawals.create }));
    expect(await drawer.findByText(text.errors.amountInvalid)).toBeVisible();

    await user.clear(amount);
    await user.type(amount, "60000");
    await user.type(drawer.getByLabelText(text.fields.note), "Avance");
    await user.click(drawer.getByRole("button", { name: text.withdrawals.create }));

    await waitFor(() => expect(detail(text.fields.balance)).toHaveTextContent(money(-11000)));
    expect(withdrawalRows().map((row) => cellsOf(row)[2])).toContain("Avance");
  });

  it("changes a withdrawal from its row, filled with what was recorded", async () => {
    serveProjects([24]);
    const user = userEvent.setup();
    openAt("/fr/employees/2402");

    await screen.findByText(text.withdrawals.title);
    const [first] = withdrawalRows();
    await user.click(
      within(first ?? document.body).getByRole("link", { name: /^Modifier le retrait/ }),
    );

    const drawer = within(await screen.findByRole("dialog", { name: text.withdrawals.editTitle }));
    const amount = drawer.getByLabelText(text.fields.amount);
    expect(amount).toHaveValue(20000);
    await user.clear(amount);
    await user.type(amount, "25000");
    await user.click(drawer.getByRole("button", { name: text.form.save }));

    await waitFor(() => expect(detail(text.fields.balance)).toHaveTextContent(money(44000)));
  });

  it("deletes a withdrawal only after confirming", async () => {
    serveProjects([25]);
    const user = userEvent.setup();
    openAt("/fr/employees/2503");

    await screen.findByText(text.withdrawals.title);
    const [first] = withdrawalRows();
    await user.click(
      within(first ?? document.body).getByRole("link", { name: /^Supprimer le retrait/ }),
    );

    const drawer = within(
      await screen.findByRole("dialog", { name: text.withdrawals.removeTitle }),
    );
    await user.click(drawer.getByRole("button", { name: text.remove.confirm }));

    await waitFor(() => expect(withdrawalRows()).toHaveLength(1));
    expect(detail(text.fields.balance)).toHaveTextContent(money(4000));
  });

  it("deletes the employee after confirming and goes back to the project", async () => {
    serveProjects([26]);
    const user = userEvent.setup();
    const router = openAt("/fr/employees/2601");

    await user.click(await screen.findByRole("link", { name: text.delete }));
    const drawer = within(await screen.findByRole("dialog", { name: text.remove.title }));
    await user.click(drawer.getByRole("button", { name: text.remove.confirm }));

    await screen.findByRole("heading", { name: text.listTitle });
    expect(router.state.location.pathname).toBe("/fr/employees/projects/26");
    expect(screen.queryByRole("cell", { name: "EMP-001" })).toBeNull();
  });
});
