import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { rightsFromApi } from "@/lib/access";
import {
  API,
  cellsOf,
  decrease,
  initial,
  mercury,
  openAt,
  page,
  returned,
  server,
  serveInventory,
  taken,
  text,
} from "./inventoryTesting";

serveInventory();

describe("ResourceScreen", () => {
  it("shows the resource's quantities, its actions and every column of its history", async () => {
    openAt("/fr/inventory/resources/2");

    expect(await screen.findByRole("heading", { name: "Mercure" })).toBeVisible();
    expect(screen.getByRole("link", { name: new RegExp(text.decrease) })).toHaveAttribute(
      "href",
      "/fr/inventory/resources/2?action=decrease",
    );
    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      text.fields.changedAt,
      text.fields.changeType,
      text.fields.quantity,
      text.fields.quantityBefore,
      text.fields.quantityAfter,
      text.fields.loss,
      text.fields.note,
      text.fields.changedBy,
    ]);
    expect(cellsOf(screen.getAllByRole("row")[1])).toEqual([
      "12/10/2026 11:00",
      `${text.refiningChangeTypes.decrease}SH-4`,
      "1,5",
      "10",
      "8,5",
      "—",
      "Lot 4",
      "Aicha",
    ]);
    expect(cellsOf(screen.getAllByRole("row")[2])).toEqual([
      "12/10/2026 08:00",
      text.changeTypes.initial,
      "10",
      "0",
      "10",
      "—",
      "—",
      "—",
    ]);
  });

  it("shows the mercury taken by a grinding and returned by its refining, with the loss", async () => {
    server.use(
      http.get(`${API}/resource-history/`, () => page([returned, taken, decrease, initial])),
    );
    openAt("/fr/inventory/resources/2");

    expect(await screen.findByRole("heading", { name: "Mercure" })).toBeVisible();
    expect(cellsOf(screen.getAllByRole("row")[1])).toEqual([
      "12/10/2026 10:00",
      `${text.changeTypes.returned}SH-4 · broyage 2`,
      "118,25",
      "380",
      "498,25",
      "1,75",
      "—",
      "Aicha",
    ]);
    expect(cellsOf(screen.getAllByRole("row")[2])).toEqual([
      "12/10/2026 09:00",
      `${text.changeTypes.taken}SH-4 · broyage 2`,
      "120",
      "500",
      "380",
      "—",
      "—",
      "Aicha",
    ]);
  });

  it("shows more mercury returned than taken as a surplus, not a loss", async () => {
    server.use(
      http.get(`${API}/resource-history/`, () =>
        page([
          { ...returned, quantity: "125.000", quantity_after: "505.000", loss: "-5.000" },
          taken,
          initial,
        ]),
      ),
    );
    openAt("/fr/inventory/resources/2");

    expect(await screen.findByRole("heading", { name: "Mercure" })).toBeVisible();
    expect(cellsOf(screen.getAllByRole("row")[1])[5]).toBe(text.surplus.replace("{quantity}", "5"));
  });

  it("shows a view-only role the resource and its history with no way to change it", async () => {
    openAt("/fr/inventory/resources/2?action=increase", {
      userId: "",
      superuser: false,
      rights: rightsFromApi([{ module: "inventory", can_view: true }]),
    });

    expect(await screen.findByRole("heading", { name: "Mercure" })).toBeVisible();
    expect(cellsOf(screen.getAllByRole("row")[1])[1]).toBe(
      `${text.refiningChangeTypes.decrease}SH-4`,
    );
    expect(screen.queryByRole("link", { name: new RegExp(text.increase) })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: new RegExp(text.decrease) })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("decreases by a quantity and a note only, with no shipment to pick", async () => {
    openAt("/fr/inventory/resources/2?action=decrease");

    const dialog = within(await screen.findByRole("dialog", { name: "Diminuer Mercure" }));

    expect(dialog.getByLabelText(text.fields.quantity)).toBeVisible();
    expect(dialog.queryAllByRole("combobox")).toHaveLength(0);
  });

  it("shows the resource's supplier and names it on the quantity it delivered", async () => {
    server.use(
      http.get(`${API}/resources/2/`, () =>
        HttpResponse.json({ ...mercury, supplier: 5, supplier_name: "Sidi Fournitures" }),
      ),
      http.get(`${API}/resource-history/`, () =>
        page([
          {
            ...decrease,
            id: 15,
            change_type: "delivered",
            refining_operation: null,
            shipment_number: null,
            supplier_delivery: 4,
            supplier_name: "Sidi Fournitures",
            note: "",
          },
        ]),
      ),
    );
    openAt("/fr/inventory/resources/2");

    expect(await screen.findByRole("heading", { name: "Mercure" })).toBeVisible();
    expect(screen.getAllByText("Sidi Fournitures")).toHaveLength(2);
    expect(cellsOf(screen.getAllByRole("row")[1])[1]).toBe(
      `${text.changeTypes.delivered}Sidi Fournitures`,
    );
  });

  it("changes the resource's supplier from a drawer", async () => {
    let body: unknown;
    server.use(
      http.get(`${API}/suppliers/`, () =>
        page([
          {
            id: 5,
            name: "Sidi Fournitures",
            paid_amount: "0.00",
            delivered_amount: "0.00",
            balance: "0.00",
            resources: [],
            created_at: "2026-10-12T08:00:00Z",
            updated_at: "2026-10-12T08:00:00Z",
          },
        ]),
      ),
      http.patch(`${API}/resources/2/`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(mercury);
      }),
    );
    const user = userEvent.setup();
    openAt("/fr/inventory/resources/2?supplier=1");

    const dialog = within(await screen.findByRole("dialog", { name: "Fournisseur : Mercure" }));
    await user.selectOptions(dialog.getByLabelText(text.fields.supplier), "5");
    await user.click(dialog.getByRole("button", { name: text.form.supplierSubmit }));

    await waitFor(() => expect(body).toEqual({ supplier: 5, is_stockable: true }));
  });

  it("answers not found for an unknown resource", async () => {
    server.use(http.get(`${API}/resources/9/`, () => new HttpResponse(null, { status: 404 })));
    openAt("/fr/inventory/resources/9");

    expect(await screen.findByText(/404/)).toBeVisible();
  });
});
