import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/format";
import {
  API,
  apiSupplier,
  cellsOf,
  common,
  kinds,
  openAt,
  page,
  serveSuppliers,
  server,
  text,
  viewOnly,
} from "./suppliersTesting";
import type { Sent } from "./suppliersTesting";

const sent: Sent[] = [];

serveSuppliers(sent);

const money = (amount: number) => formatMoney(amount, "fr");

describe("SuppliersScreen", () => {
  it("lists each supplier with its resources, the backend's amounts and what is owed", async () => {
    openAt("/fr/suppliers");

    expect(await screen.findByRole("link", { name: "Sidi Fournitures" })).toHaveAttribute(
      "href",
      "/fr/suppliers/5",
    );
    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      text.fields.name,
      text.fields.phone,
      text.fields.resources,
      text.fields.paid,
      text.fields.delivered,
      text.fields.balance,
      text.fields.status,
    ]);
    expect(cellsOf(screen.getAllByRole("row")[1])).toEqual([
      "Sidi Fournitures",
      "+222 22 41 18 30",
      kinds.mercury,
      money(1000),
      money(1300),
      money(-300),
      text.status.owed,
    ]);
  });

  it("asks the backend for the search and the balance status in the address", async () => {
    let query: URLSearchParams | undefined;
    server.use(
      http.get(`${API}/suppliers/`, ({ request }) => {
        query = new URL(request.url).searchParams;
        return page([]);
      }),
    );
    openAt("/fr/suppliers?q=sidi&status=advance");

    expect(await screen.findByText(text.noResults)).toBeVisible();
    expect(query?.get("search")).toBe("sidi");
    expect(query?.get("balance_status")).toBe("advance");
  });

  it("ignores a balance status the backend does not know", async () => {
    let query: URLSearchParams | undefined;
    server.use(
      http.get(`${API}/suppliers/`, ({ request }) => {
        query = new URL(request.url).searchParams;
        return page([]);
      }),
    );
    openAt("/fr/suppliers?status=paid");

    expect(await screen.findByText(text.empty)).toBeVisible();
    expect(query?.has("balance_status")).toBe(false);
  });

  it("adds a supplier and opens its page", async () => {
    const user = userEvent.setup();
    const router = openAt("/fr/suppliers?new=1");

    const dialog = within(await screen.findByRole("dialog", { name: text.form.newTitle }));
    await user.type(dialog.getByLabelText(text.fields.name), "Ahmed Gaz");
    await user.type(dialog.getByLabelText(text.fields.phone), "22411830");
    await user.click(dialog.getByRole("button", { name: text.form.create }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/fr/suppliers/6"));
    expect(sent).toEqual([
      {
        method: "POST",
        path: "/suppliers/",
        body: { name: "Ahmed Gaz", phone: "+22222411830", notes: "" },
        key: expect.any(String),
      },
    ]);
  });

  it("requires the supplier's name", async () => {
    const user = userEvent.setup();
    openAt("/fr/suppliers?new=1");

    const dialog = within(await screen.findByRole("dialog", { name: text.form.newTitle }));
    await user.click(dialog.getByRole("button", { name: text.form.create }));

    expect(await dialog.findByText(common.validation.required)).toBeVisible();
    expect(sent).toEqual([]);
  });

  it("shows the backend's refusal on the name", async () => {
    server.use(
      http.post(`${API}/suppliers/`, () =>
        Response.json({ name: ["Ce fournisseur existe déjà."] }, { status: 400 }),
      ),
    );
    const user = userEvent.setup();
    openAt("/fr/suppliers?new=1");

    const dialog = within(await screen.findByRole("dialog", { name: text.form.newTitle }));
    await user.type(dialog.getByLabelText(text.fields.name), apiSupplier.name);
    await user.click(dialog.getByRole("button", { name: text.form.create }));

    expect(await dialog.findByText("Ce fournisseur existe déjà.")).toBeVisible();
  });

  it("gives a view-only role the list with no way to add", async () => {
    openAt("/fr/suppliers?new=1", viewOnly);

    expect(await screen.findByRole("link", { name: "Sidi Fournitures" })).toBeVisible();
    expect(screen.queryByRole("link", { name: new RegExp(text.new) })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
