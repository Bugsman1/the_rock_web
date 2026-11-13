import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/format";
import {
  API,
  apiDelivery,
  apiSupplier,
  cellsOf,
  common,
  kinds,
  openAt,
  serveSuppliers,
  server,
  text,
  viewOnly,
} from "./suppliersTesting";
import type { Sent } from "./suppliersTesting";

const sent: Sent[] = [];

serveSuppliers(sent);

const money = (amount: number) => formatMoney(amount, "fr");

describe("SupplierScreen", () => {
  it("shows the supplier's balance and its account as the backend computed it", async () => {
    openAt("/fr/suppliers/5");

    expect(await screen.findByRole("heading", { name: "Sidi Fournitures" })).toBeVisible();
    expect(screen.getByText(text.status.owed)).toBeVisible();
    expect(screen.getByText(`${kinds.mercury} · Zouérat 1`)).toBeVisible();
    expect(cellsOf(screen.getAllByRole("row")[1])).toEqual([
      "12/10/2026 09:00",
      text.account.types.payment,
      "—",
      money(1000),
      money(1000),
      "Avance",
      "Aicha",
      `${text.edit}${text.delete}`,
    ]);
    expect(cellsOf(screen.getAllByRole("row")[2])).toEqual([
      "12/10/2026 10:00",
      text.account.types.delivery,
      `${kinds.mercury} · 100`,
      money(-1300),
      money(-300),
      "—",
      "Aicha",
      `${text.edit}${text.delete}`,
    ]);
  });

  it("records a payment, which the backend adds to the balance", async () => {
    const user = userEvent.setup();
    openAt("/fr/suppliers/5?addPayment=1");

    const dialog = within(await screen.findByRole("dialog", { name: text.payments.newTitle }));
    await user.type(dialog.getByLabelText(text.formFields.amount), "500");
    await user.type(dialog.getByLabelText(text.formFields.note), "Avance");
    await user.click(dialog.getByRole("button", { name: text.payments.create }));

    await waitFor(() =>
      expect(sent).toEqual([
        {
          method: "POST",
          path: "/supplier-payments/",
          body: { supplier: 5, amount: "500", paid_at: expect.any(String), notes: "Avance" },
          key: expect.any(String),
        },
      ]),
    );
  });

  it("refuses a payment of zero", async () => {
    const user = userEvent.setup();
    openAt("/fr/suppliers/5?addPayment=1");

    const dialog = within(await screen.findByRole("dialog", { name: text.payments.newTitle }));
    await user.type(dialog.getByLabelText(text.formFields.amount), "0");
    await user.click(dialog.getByRole("button", { name: text.payments.create }));

    expect(await dialog.findByText(text.errors.amountInvalid)).toBeVisible();
    expect(sent).toEqual([]);
  });

  it("records a delivery of one of the supplier's resources at the price of the whole delivery", async () => {
    const user = userEvent.setup();
    openAt("/fr/suppliers/5?addDelivery=1");

    const dialog = within(await screen.findByRole("dialog", { name: text.deliveries.newTitle }));
    await user.selectOptions(dialog.getByLabelText(text.formFields.resource), "2");
    await user.type(dialog.getByLabelText(text.formFields.quantity), "50");
    await user.type(dialog.getByLabelText(text.formFields.price), "200");
    await user.click(dialog.getByRole("button", { name: text.deliveries.create }));

    await waitFor(() =>
      expect(sent).toEqual([
        {
          method: "POST",
          path: "/supplier-deliveries/",
          body: {
            resource: 2,
            quantity: "50.000",
            price: "200",
            delivered_at: expect.any(String),
            notes: "",
          },
          key: expect.any(String),
        },
      ]),
    );
  });

  it("shows the backend's refusal on the delivery's quantity", async () => {
    server.use(
      http.patch(`${API}/supplier-deliveries/4/`, () =>
        HttpResponse.json({ quantity: ["Le stock a déjà été utilisé."] }, { status: 400 }),
      ),
    );
    const user = userEvent.setup();
    openAt("/fr/suppliers/5?delivery=4");

    const dialog = within(await screen.findByRole("dialog", { name: text.deliveries.editTitle }));
    await user.clear(dialog.getByLabelText(text.formFields.quantity));
    await user.type(dialog.getByLabelText(text.formFields.quantity), "20");
    await user.click(dialog.getByRole("button", { name: text.form.save }));

    expect(await dialog.findByText("Le stock a déjà été utilisé.")).toBeVisible();
  });

  it("edits a delivery without moving it to another resource", async () => {
    const user = userEvent.setup();
    openAt("/fr/suppliers/5?delivery=4");

    const dialog = within(await screen.findByRole("dialog", { name: text.deliveries.editTitle }));
    expect(dialog.getByText(`${kinds.mercury} · Zouérat 1`)).toBeVisible();
    expect(dialog.queryByLabelText(text.formFields.resource)).not.toBeInTheDocument();

    await user.clear(dialog.getByLabelText(text.formFields.price));
    await user.type(dialog.getByLabelText(text.formFields.price), "1200");
    await user.click(dialog.getByRole("button", { name: text.form.save }));

    await waitFor(() =>
      expect(sent).toEqual([
        expect.objectContaining({
          method: "PATCH",
          path: "/supplier-deliveries/4/",
          body: {
            quantity: "100.000",
            price: "1200",
            delivered_at: "2026-10-12T10:00:00.000Z",
            notes: "",
          },
        }),
      ]),
    );
  });

  it("keeps the quantity of a resource's initial delivery fixed", async () => {
    server.use(
      http.get(`${API}/supplier-deliveries/4/`, () =>
        HttpResponse.json({ ...apiDelivery, is_initial: true }),
      ),
    );
    const user = userEvent.setup();
    openAt("/fr/suppliers/5?delivery=4");

    const dialog = within(await screen.findByRole("dialog", { name: text.deliveries.editTitle }));
    expect(dialog.queryByLabelText(text.formFields.quantity)).not.toBeInTheDocument();

    await user.clear(dialog.getByLabelText(text.formFields.price));
    await user.type(dialog.getByLabelText(text.formFields.price), "900");
    await user.click(dialog.getByRole("button", { name: text.form.save }));

    await waitFor(() =>
      expect(sent[0]?.body).toEqual({
        price: "900",
        delivered_at: "2026-10-12T10:00:00.000Z",
        notes: "",
      }),
    );
  });

  it("deletes a payment only once confirmed", async () => {
    const user = userEvent.setup();
    openAt("/fr/suppliers/5?deletePayment=7");

    const dialog = within(await screen.findByRole("dialog", { name: text.payments.removeTitle }));
    expect(sent).toEqual([]);

    await user.click(dialog.getByRole("button", { name: common.remove.confirm }));

    await waitFor(() =>
      expect(sent).toEqual([
        expect.objectContaining({ method: "DELETE", path: "/supplier-payments/7/" }),
      ]),
    );
  });

  it("deletes a delivery only once confirmed", async () => {
    const user = userEvent.setup();
    openAt("/fr/suppliers/5?deleteDelivery=4");

    const dialog = within(await screen.findByRole("dialog", { name: text.deliveries.removeTitle }));
    await user.click(dialog.getByRole("button", { name: common.remove.confirm }));

    await waitFor(() =>
      expect(sent).toEqual([
        expect.objectContaining({ method: "DELETE", path: "/supplier-deliveries/4/" }),
      ]),
    );
  });

  it("shows why the backend refuses to delete a supplier", async () => {
    server.use(
      http.delete(`${API}/suppliers/5/`, () =>
        HttpResponse.json(["Ce fournisseur a des livraisons."], { status: 400 }),
      ),
    );
    const user = userEvent.setup();
    openAt("/fr/suppliers/5?delete=1");

    const dialog = within(await screen.findByRole("dialog", { name: text.remove.title }));
    await user.click(dialog.getByRole("button", { name: common.remove.confirm }));

    expect(await dialog.findByText("Ce fournisseur a des livraisons.")).toBeVisible();
  });

  it("edits the supplier", async () => {
    const user = userEvent.setup();
    openAt("/fr/suppliers/5?edit=1");

    const dialog = within(await screen.findByRole("dialog", { name: text.form.editTitle }));
    await user.type(dialog.getByLabelText(text.fields.notes), "Livre le lundi");
    await user.click(dialog.getByRole("button", { name: text.form.save }));

    await waitFor(() =>
      expect(sent).toEqual([
        expect.objectContaining({
          method: "PATCH",
          path: "/suppliers/5/",
          body: { name: apiSupplier.name, phone: "+22222411830", notes: "Livre le lundi" },
        }),
      ]),
    );
  });

  it("offers no delivery for a supplier with no resource", async () => {
    server.use(
      http.get(`${API}/suppliers/5/`, () => HttpResponse.json({ ...apiSupplier, resources: [] })),
    );
    openAt("/fr/suppliers/5");

    expect(await screen.findByRole("heading", { name: "Sidi Fournitures" })).toBeVisible();
    expect(screen.getByRole("link", { name: new RegExp(text.payments.add) })).toBeVisible();
    expect(
      screen.queryByRole("link", { name: new RegExp(text.deliveries.add) }),
    ).not.toBeInTheDocument();
  });

  it("gives a view-only role the account with no way to change it", async () => {
    openAt("/fr/suppliers/5?addPayment=1", viewOnly);

    expect(await screen.findByRole("heading", { name: "Sidi Fournitures" })).toBeVisible();
    expect(
      screen.queryByRole("link", { name: new RegExp(text.payments.add) }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: new RegExp(text.edit) })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(cellsOf(screen.getAllByRole("row")[1])).toHaveLength(7);
  });

  it("answers not found for an unknown supplier", async () => {
    server.use(
      http.get(`${API}/suppliers/9/`, () => new HttpResponse(null, { status: 404 })),
      http.get(`${API}/suppliers/9/history/`, () => new HttpResponse(null, { status: 404 })),
    );
    openAt("/fr/suppliers/9");

    expect(await screen.findByText(/404/)).toBeVisible();
  });
});
