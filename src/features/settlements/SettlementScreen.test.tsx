import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { rightsFromApi } from "@/lib/access";
import { formatMoney } from "@/lib/format";
import messages from "@/messages/fr.json";
import type * as settlementsApi from "./settlementsApi";
import {
  API,
  apiSettlement,
  cellsOf,
  openAt,
  server,
  serveSettlements,
  text,
} from "./settlementsTesting";

serveSettlements();

const pdf = vi.hoisted(() => ({ getSettlementPdf: vi.fn() }));

vi.mock("./settlementsApi", async (importOriginal) => ({
  ...(await importOriginal<typeof settlementsApi>()),
  getSettlementPdf: pdf.getSettlementPdf,
}));

const title = text.detail.title.replace("{number}", "STL-2026-00004");

const money = (amount: number) => formatMoney(amount, "fr");

describe("SettlementScreen", () => {
  it("shows the settlement and every amount up to the final amount due", async () => {
    openAt("/fr/settlements/4");

    expect(await screen.findByRole("heading", { name: title })).toBeVisible();
    expect(screen.getByText("Ahmed")).toBeVisible();
    expect(screen.getByText("+222 22 41 18 30")).toHaveAttribute("dir", "ltr");
    expect(screen.getByText("SHP-00001, SHP-00002")).toBeVisible();

    const [header, ...rows] = screen.getAllByRole("row");
    expect(header).toHaveTextContent(`${text.totals.item}${text.totals.amount}`);
    expect(rows.map((row) => cellsOf(row))).toEqual([
      [text.totals.bagsTransport, money(21000)],
      [text.totals.passengersTransport, money(3000)],
      [text.totals.shipmentsDebt, money(250)],
      [`${text.totals.grindingCost}20 sacs × ${money(250)}`, money(5000)],
      [`${text.totals.refiningCost}12,25 g × ${money(1500)}`, money(18375)],
      [`${text.totals.extraDebt}Avance sur carburant`, money(2000)],
      [text.totals.grandTotal, money(49625)],
    ]);
  });

  it("changes the amounts entered for the settlement", async () => {
    let sent: unknown;
    server.use(
      http.patch(`${API}/settlements/4/`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(apiSettlement);
      }),
    );
    const router = openAt("/fr/settlements/4?edit=1");
    const user = userEvent.setup();

    const dialog = within(await screen.findByRole("dialog", { name: /STL-2026-00004/ }));
    expect(dialog.queryByRole("checkbox")).not.toBeInTheDocument();
    await user.clear(dialog.getByLabelText(text.fields.grindingCostPerBag));
    await user.type(dialog.getByLabelText(text.fields.grindingCostPerBag), "300");
    await user.click(dialog.getByRole("button", { name: text.form.saveChanges }));

    await waitFor(() => {
      expect(router.state.location.search).toBe("");
    });
    expect(sent).toEqual({
      grinding_cost_per_bag: "300",
      refining_cost_per_gram: "1500",
      debt: "2000",
      debt_description: "Avance sur carburant",
    });
  });

  it("deletes the settlement and goes back to its project", async () => {
    let deleted = false;
    server.use(
      http.delete(`${API}/settlements/4/`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const router = openAt("/fr/settlements/4?delete=1");
    const user = userEvent.setup();

    const dialog = within(await screen.findByRole("dialog", { name: text.delete.title }));
    await user.click(dialog.getByRole("button", { name: text.delete.confirm }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/fr/settlements/projects/3");
    });
    expect(deleted).toBe(true);
  });

  it("previews the invoice in the language chosen", async () => {
    pdf.getSettlementPdf.mockResolvedValue({
      file: new Blob(["%PDF"], { type: "application/pdf" }),
      fileName: "STL-2026-00004.pdf",
    });
    URL.createObjectURL = vi.fn(() => "blob:settlement");
    URL.revokeObjectURL = vi.fn();
    openAt("/fr/settlements/4");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: text.pdf.fr }));

    const preview = within(
      await screen.findByRole("dialog", { name: messages.common.pdf.previewTitle }),
    );
    expect(pdf.getSettlementPdf).toHaveBeenCalledWith(
      expect.objectContaining({ id: "4" }),
      "fr",
      "reglement-STL-2026-00004-fr.pdf",
    );
    expect(preview.getByRole("link", { name: messages.common.pdf.download })).toHaveAttribute(
      "download",
      "STL-2026-00004.pdf",
    );
  });

  it("offers no edit or delete to a role that can only view settlements", async () => {
    openAt("/fr/settlements/4?edit=1", {
      userId: "",
      superuser: false,
      rights: rightsFromApi([{ module: "settlements", can_view: true }]),
    });

    expect(await screen.findByRole("heading", { name: title })).toBeVisible();
    expect(screen.queryByRole("link", { name: new RegExp(text.detail.edit) })).toBeNull();
    expect(screen.queryByRole("link", { name: new RegExp(text.detail.delete) })).toBeNull();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
