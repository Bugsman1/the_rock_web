import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { API, apiTransaction, openAt, serveCash, server, text } from "./cashTesting";
import type { Sent } from "./cashTesting";

const sent: Sent[] = [];
serveCash(sent);

describe("CashDetail", () => {
  it("shows a manual movement's details with the way to edit or delete it", async () => {
    openAt("/fr/cash/projects/3?view=9");

    const dialog = within(await screen.findByRole("dialog", { name: text.detailTitle }));
    expect(dialog.getByText("Gasoil groupe")).toBeVisible();
    expect(dialog.getByText("Sidi Fournitures")).toBeVisible();
    expect(dialog.queryByText(text.fields.customer)).toBeNull();
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
    expect(dialog.queryByText(text.fields.supplier)).toBeNull();
    expect(dialog.getByText(text.sources.debt_payment)).toBeVisible();
    expect(dialog.queryByRole("link")).toBeNull();
  });

  it("shows no supplier on a settlement return, whatever name comes with it", async () => {
    server.use(
      http.get(`${API}/cash-transactions/11/`, () =>
        HttpResponse.json({
          ...apiTransaction,
          id: 11,
          transaction_type: "income",
          category: "settlement_return",
          source: "settlement_return",
          supplier: null,
          supplier_name: "Sidi Fournitures",
          customer: 7,
          customer_name: "Ahmed",
          description: "",
        }),
      ),
    );
    openAt("/fr/cash/projects/3?view=11");

    const dialog = within(await screen.findByRole("dialog", { name: text.detailTitle }));
    expect(dialog.getByText("Ahmed")).toBeVisible();
    expect(dialog.queryByText(text.fields.supplier)).toBeNull();
    expect(dialog.queryByText(text.fields.description)).toBeNull();
  });
});
