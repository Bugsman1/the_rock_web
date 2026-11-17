import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/format";
import messages from "@/messages/fr.json";
import { openAt, serveAccounting, text } from "./accountingTesting";
import type { Asked, Sent } from "./accountingTesting";

const asked: Asked = {};
const sent: Sent[] = [];
serveAccounting(asked, sent);

const period = "from=2026-11-01&to=2026-11-30";
const money = (amount: number) => formatMoney(amount, "fr").replace(/\s/g, " ");

function panel(title: string) {
  return within(screen.getByRole("heading", { name: title }).closest("section") ?? document.body);
}

describe("AccountingProjectScreen review", () => {
  it("lists the project's movements waiting for approval and approves one", async () => {
    const user = userEvent.setup();
    openAt(`/fr/accounting/projects/3?${period}`);

    await screen.findByRole("heading", { name: text.approval.title });
    expect(asked.pending?.get("project")).toBe("3");
    expect(asked.pending?.get("status")).toBe("pending");
    const pending = panel(text.approval.title);
    expect(pending.getByText("Sidi Fournitures")).toBeVisible();

    await user.click(pending.getByRole("button", { name: /Approuver le mouvement/ }));

    await waitFor(() =>
      expect(sent).toEqual([
        { method: "POST", path: "/cash-transactions/9/approve/", body: undefined },
      ]),
    );
  });

  it("rejects a movement only once confirmed", async () => {
    const user = userEvent.setup();
    openAt(`/fr/accounting/projects/3?${period}&reject=9`);

    const dialog = within(await screen.findByRole("dialog", { name: text.approval.rejectTitle }));
    expect(dialog.getByText(/Carburant/)).toBeVisible();
    expect(sent).toEqual([]);

    await user.click(dialog.getByRole("button", { name: text.approval.reject }));

    await waitFor(() =>
      expect(sent).toEqual([
        { method: "POST", path: "/cash-transactions/9/reject/", body: undefined },
      ]),
    );
  });

  it("enters a shipment's return, never above its total cost, and locks an approved one", async () => {
    const user = userEvent.setup();
    openAt(`/fr/accounting/projects/3?${period}`);

    await screen.findByRole("heading", { name: text.shipmentReturns.title });
    const returns = panel(text.shipmentReturns.title);
    expect(returns.getAllByRole("link", { name: /Saisir le retour/ })).toHaveLength(1);

    await user.click(returns.getByRole("link", { name: /Saisir le retour de SHP-00052/ }));
    const dialog = within(
      await screen.findByRole("dialog", { name: "Retour de l'expédition SHP-00052" }),
    );

    await user.type(dialog.getByLabelText(text.shipmentReturns.return), "31000");
    await user.click(dialog.getByRole("button", { name: text.shipmentReturns.save }));
    expect(
      await dialog.findByText(text.shipmentReturns.returnInvalid.replace("{max}", money(30000))),
    ).toBeVisible();
    expect(sent).toEqual([]);

    await user.clear(dialog.getByLabelText(text.shipmentReturns.return));
    await user.type(dialog.getByLabelText(text.shipmentReturns.return), "22000");
    await user.click(dialog.getByRole("button", { name: text.shipmentReturns.save }));

    await waitFor(() =>
      expect(sent).toEqual([
        {
          method: "PATCH",
          path: "/settlements/4/shipments/52/return/",
          body: { return_amount: "22000" },
        },
      ]),
    );
  });

  it("shows what the project's customers owe and what it owes its suppliers", async () => {
    openAt(`/fr/accounting/projects/3?${period}`);

    await screen.findByRole("heading", { name: text.receivables.title });
    expect(asked.receivables?.get("project")).toBe("3");
    expect(asked.payables?.get("project")).toBe("3");
    expect(panel(text.receivables.title).getByRole("row", { name: /Total/ })).toHaveTextContent(
      money(12000),
    );
    expect(panel(text.payables.title).getByText("Sidi Fournitures")).toBeVisible();
    expect(panel(text.payables.advancesTitle).getByText(text.payables.advancesEmpty)).toBeVisible();
    expect(screen.queryByText(messages.common.saveFailed)).toBeNull();
  });
});
