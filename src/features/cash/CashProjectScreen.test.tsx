import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/format";
import {
  API,
  apiBalance,
  apiTransaction,
  cellsOf,
  common,
  openAt,
  page,
  serveCash,
  server,
  text,
  viewOnly,
} from "./cashTesting";
import type { Sent } from "./cashTesting";

const sent: Sent[] = [];
serveCash(sent);

const money = (amount: number) => formatMoney(amount, "fr");
const spaced = (amount: number) => money(amount).replace(/\s/g, " ");

function panel(title: string) {
  const section = screen.getByRole("heading", { name: title }).closest("section");

  if (section === null) {
    throw new Error(`no panel ${title}`);
  }

  return within(section);
}

describe("CashProjectScreen", () => {
  it("shows only this project's money and asks the backend for its movements only", async () => {
    let asked: { balance?: string | null; list?: string | null } = {};
    server.use(
      http.get(`${API}/cash-transactions/balance/`, ({ request }) => {
        asked = { ...asked, balance: new URL(request.url).searchParams.get("project") };
        return HttpResponse.json([apiBalance]);
      }),
      http.get(`${API}/cash-transactions/`, ({ request }) => {
        asked = { ...asked, list: new URL(request.url).searchParams.get("project") };
        return page([apiTransaction]);
      }),
    );
    openAt("/fr/cash/projects/3");

    expect(
      await screen.findByRole("heading", {
        name: common.projectTitle.replace("{name}", "Zouérat 1"),
      }),
    ).toBeVisible();
    expect(asked).toEqual({ balance: "3", list: "3" });
    expect(screen.getByText(text.balances.balance).nextElementSibling).toHaveTextContent(
      spaced(1025000),
    );
    expect(screen.getByRole("link", { name: common.back })).toHaveAttribute("href", "/fr/cash");
  });

  it("lists every movement with its sign, each row opening its details", async () => {
    openAt("/fr/cash/projects/3");

    await screen.findByText("Sidi Fournitures");
    const list = panel(text.list.title);
    const [expense, income] = list.getAllByRole("row").slice(1);

    expect(cellsOf(expense)).toContain(`−${money(15000)}`);
    expect(cellsOf(expense)).toContain("Sidi Fournitures");
    expect(cellsOf(income)).toContain(`+${money(40000)}`);
    expect(cellsOf(income)).toContain("Ahmed");
    expect(screen.queryByText("Gasoil groupe")).toBeNull();
    expect(within(expense ?? document.body).getByRole("link")).toHaveAttribute(
      "href",
      "/fr/cash/projects/3?view=9",
    );
    expect(within(income ?? document.body).getByRole("link")).toHaveAttribute(
      "href",
      "/fr/cash/projects/3?view=10",
    );
  });

  it("shows a manual movement's details with the way to edit or delete it", async () => {
    openAt("/fr/cash/projects/3?view=9");

    const dialog = within(await screen.findByRole("dialog", { name: text.detailTitle }));
    expect(dialog.getByText("Gasoil groupe")).toBeVisible();
    expect(dialog.getByText(text.sources.manual)).toBeVisible();
    expect(dialog.getByText("Aicha")).toBeVisible();
    expect(dialog.getByRole("link", { name: text.edit })).toHaveAttribute(
      "href",
      "/fr/cash/projects/3?edit=9",
    );
    expect(dialog.getByRole("link", { name: text.delete })).toHaveAttribute(
      "href",
      "/fr/cash/projects/3?delete=9",
    );
  });

  it("shows where an automatic movement comes from, with no way to change it", async () => {
    openAt("/fr/cash/projects/3?view=10");

    const dialog = within(await screen.findByRole("dialog", { name: text.detailTitle }));
    expect(dialog.getByText("Ahmed")).toBeVisible();
    expect(dialog.getByText(text.sources.debt_payment)).toBeVisible();
    expect(dialog.queryByRole("link")).toBeNull();
  });

  it("asks the backend for the filters kept in the address", async () => {
    let asked: URLSearchParams | undefined;
    server.use(
      http.get(`${API}/cash-transactions/`, ({ request }) => {
        asked = new URL(request.url).searchParams;
        return page([]);
      }),
    );
    openAt("/fr/cash/projects/3?type=expense&category=fuel&from=2026-11-01&q=gasoil");

    expect(await screen.findByText(text.list.noResults)).toBeVisible();
    expect(asked?.get("transaction_type")).toBe("expense");
    expect(asked?.getAll("category__in")).toEqual(["fuel"]);
    expect(asked?.get("project")).toBe("3");
    expect(asked?.get("transaction_date__date__gte")).toBe("2026-11-01");
    expect(asked?.get("search")).toBe("gasoil");
  });

  it("records an expense of a project under one of the manual expense categories", async () => {
    const user = userEvent.setup();
    openAt("/fr/cash/projects/3?new=expense");

    const dialog = within(await screen.findByRole("dialog", { name: text.form.expenseTitle }));
    expect(
      within(dialog.getByLabelText(text.fields.category))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Carburant", "Dépenses quotidiennes", "Camions", "Autres dépenses"]);

    await user.selectOptions(dialog.getByLabelText(text.fields.category), "fuel");
    await user.type(dialog.getByLabelText(text.fields.amount), "2500");
    await user.type(dialog.getByLabelText(text.fields.description), "Gasoil");
    await user.selectOptions(dialog.getByLabelText(text.fields.supplier), "5");
    await user.click(dialog.getByRole("button", { name: text.form.create }));

    await waitFor(() =>
      expect(sent).toEqual([
        {
          method: "POST",
          path: "/cash-transactions/",
          body: {
            project: 3,
            transaction_type: "expense",
            category: "fuel",
            category_name: "",
            amount: "2500",
            transaction_date: expect.any(String),
            description: "Gasoil",
            customer: null,
            supplier: 5,
          },
          key: expect.any(String),
        },
      ]),
    );
  });

  it("records an income received from a customer picked by name", async () => {
    const user = userEvent.setup();
    openAt("/fr/cash/projects/3?new=income");

    const dialog = within(await screen.findByRole("dialog", { name: text.form.incomeTitle }));
    await user.selectOptions(dialog.getByLabelText(text.fields.category), "grinding_income");
    await user.type(dialog.getByLabelText(text.fields.amount), "8000");
    await user.type(dialog.getByLabelText(text.fields.description), "Broyage SHP-12");
    await user.type(dialog.getByLabelText(text.fields.customer), "Ahm");
    await user.click(await screen.findByRole("option", { name: /Ahmed/ }));
    await user.click(dialog.getByRole("button", { name: text.form.create }));

    await waitFor(() =>
      expect(sent).toEqual([
        expect.objectContaining({
          body: expect.objectContaining({
            transaction_type: "income",
            category: "grinding_income",
            customer: 7,
            supplier: null,
          }),
        }),
      ]),
    );
  });

  it("records another expense under the name the user types", async () => {
    const user = userEvent.setup();
    openAt("/fr/cash/projects/3?new=expense");

    const dialog = within(await screen.findByRole("dialog", { name: text.form.expenseTitle }));
    expect(dialog.queryByLabelText(text.fields.categoryName)).toBeNull();

    await user.selectOptions(dialog.getByLabelText(text.fields.category), "other_expense");
    await user.type(dialog.getByLabelText(text.fields.amount), "1200");
    await user.type(dialog.getByLabelText(text.fields.description), "Pneus");
    await user.click(dialog.getByRole("button", { name: text.form.create }));

    expect(await dialog.findByText(common.validation.required)).toBeVisible();
    expect(sent).toEqual([]);

    await user.type(dialog.getByLabelText(text.fields.categoryName), "Pneumatiques");
    await user.click(dialog.getByRole("button", { name: text.form.create }));

    await waitFor(() =>
      expect(sent).toEqual([
        expect.objectContaining({
          body: expect.objectContaining({
            category: "other_expense",
            category_name: "Pneumatiques",
          }),
        }),
      ]),
    );
  });

  it("requires the category, an amount and a description", async () => {
    const user = userEvent.setup();
    openAt("/fr/cash/projects/3?new=income");

    const dialog = within(await screen.findByRole("dialog", { name: text.form.incomeTitle }));
    await user.click(dialog.getByRole("button", { name: text.form.create }));

    expect(await dialog.findAllByText(common.validation.required)).toHaveLength(2);
    expect(dialog.getByText(text.form.amountInvalid)).toBeVisible();
    expect(sent).toEqual([]);
  });

  it("edits a manual movement from its saved values", async () => {
    const user = userEvent.setup();
    openAt("/fr/cash/projects/3?edit=9");

    const dialog = within(await screen.findByRole("dialog", { name: text.form.editTitle }));
    expect(dialog.getByLabelText(text.fields.description)).toHaveValue("Gasoil groupe");

    await user.clear(dialog.getByLabelText(text.fields.amount));
    await user.type(dialog.getByLabelText(text.fields.amount), "16000");
    await user.click(dialog.getByRole("button", { name: text.form.save }));

    await waitFor(() =>
      expect(sent).toEqual([
        expect.objectContaining({
          method: "PATCH",
          path: "/cash-transactions/9/",
          body: expect.objectContaining({
            project: 3,
            transaction_type: "expense",
            category: "fuel",
            amount: "16000",
            supplier: 5,
          }),
        }),
      ]),
    );
  });

  it("deletes a manual movement only once confirmed", async () => {
    const user = userEvent.setup();
    openAt("/fr/cash/projects/3?delete=9");

    const dialog = within(await screen.findByRole("dialog", { name: text.remove.title }));
    expect(sent).toEqual([]);

    await user.click(dialog.getByRole("button", { name: common.remove.confirm }));

    await waitFor(() =>
      expect(sent).toEqual([
        expect.objectContaining({ method: "DELETE", path: "/cash-transactions/9/" }),
      ]),
    );
  });

  it("never opens an automatic movement for change", async () => {
    openAt("/fr/cash/projects/3?edit=10");

    expect(await screen.findByText("Ahmed")).toBeVisible();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("gives a view-only role the balances and movements with no way to change them", async () => {
    openAt("/fr/cash/projects/3?new=income", viewOnly);

    expect(await screen.findByText("Sidi Fournitures")).toBeVisible();
    expect(screen.queryByRole("link", { name: new RegExp(text.recordIncome) })).toBeNull();
    expect(screen.queryByRole("link", { name: text.edit })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
