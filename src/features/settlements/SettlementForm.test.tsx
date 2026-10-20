import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "use-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/fr.json";
import { SettlementForm } from "./SettlementForm";
import type { NewSettlementValues } from "./settlements";
import { shipmentRecord, text } from "./settlementsTesting";

const onSave = vi.fn();

beforeEach(() => {
  onSave.mockReset();
  onSave.mockResolvedValue({ ok: true });
});

const empty: NewSettlementValues = {
  shipmentIds: ["1"],
  grindingCost: Number.NaN,
  refiningCostPerGram: Number.NaN,
  debt: Number.NaN,
  debtDescription: "",
};

function renderForm(defaultValues: NewSettlementValues = empty) {
  render(
    <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
      <SettlementForm
        defaultValues={defaultValues}
        shipments={[
          shipmentRecord({ id: "1", shipmentNumber: "SHP-00001" }),
          shipmentRecord({
            id: "2",
            shipmentNumber: "SHP-00002",
            status: "grinding",
            stage: "grinding",
          }),
        ]}
        submitLabel={text.form.submit}
        savedMessage={messages.toasts.settlementAdded}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    </IntlProvider>,
  );

  return userEvent.setup();
}

const select = (number: string) =>
  screen.getByLabelText(text.form.select.replace("{number}", number));

describe("SettlementForm", () => {
  it("settles the ticked shipments with what the user entered", async () => {
    const user = renderForm();

    expect(select("SHP-00001")).toBeChecked();
    expect(select("SHP-00002")).not.toBeChecked();

    await user.click(select("SHP-00002"));
    await user.type(screen.getByLabelText(text.fields.grindingCost), "5000");
    await user.type(screen.getByLabelText(text.fields.refiningCostPerGram), "1500");
    await user.type(screen.getByLabelText(text.fields.debt), "2000");
    await user.type(screen.getByLabelText(text.fields.debtDescription), "Avance");
    await user.click(screen.getByRole("button", { name: text.form.submit }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        shipmentIds: ["1", "2"],
        grindingCost: 5000,
        refiningCostPerGram: 1500,
        debt: 2000,
        debtDescription: "Avance",
      });
    });
    expect(screen.getByRole("status", { name: text.form.saving })).toBeInTheDocument();
  });

  it("needs at least one shipment", async () => {
    const user = renderForm();

    await user.click(select("SHP-00001"));
    await user.click(screen.getByRole("button", { name: text.form.submit }));

    expect(await screen.findByText(text.errors.shipmentsRequired)).toBeVisible();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("refuses a negative amount", async () => {
    const user = renderForm();

    await user.type(screen.getByLabelText(text.fields.grindingCost), "-5");
    await user.click(screen.getByRole("button", { name: text.form.submit }));

    expect(await screen.findByText(text.errors.amountInvalid)).toBeVisible();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("shows why the backend refused the settlement", async () => {
    onSave.mockResolvedValue({
      ok: false,
      fieldErrors: { shipmentIds: "Déjà réglée : SHP-00001." },
      failed: false,
    });
    const user = renderForm();

    await user.click(screen.getByRole("button", { name: text.form.submit }));

    expect(await screen.findByText("Déjà réglée : SHP-00001.")).toBeVisible();
    expect(screen.getByRole("button", { name: text.form.submit })).toBeVisible();
  });

  it("says when the save failed for another reason", async () => {
    onSave.mockResolvedValue({ ok: false, fieldErrors: {}, failed: true });
    const user = renderForm();

    await user.click(screen.getByRole("button", { name: text.form.submit }));

    expect(await screen.findByText(messages.common.saveFailed)).toBeVisible();
  });
});
