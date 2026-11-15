import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/fr.json";
import { inFrench, mercuryResource, text } from "./inventoryTesting";
import { ResourceChangeForm } from "./InventoryForms";
import type { Resource, ResourceChangeType } from "./resources";

const api = vi.hoisted(() => ({
  changeResourceQuantity: vi.fn(),
}));

vi.mock("./resourcesApi", () => api);

const onSaved = vi.fn();

beforeEach(() => {
  onSaved.mockReset();
  for (const mock of Object.values(api)) {
    mock.mockReset();
    mock.mockResolvedValue({ ok: true });
  }
});

const fields = text.fields;
const mercury = mercuryResource;

function renderChangeForm(type: ResourceChangeType, resource: Resource = mercury) {
  return inFrench(
    <ResourceChangeForm resource={resource} type={type} onSaved={onSaved} onCancel={vi.fn()} />,
  );
}

const supplied: Resource = { ...mercury, suppliers: [{ id: "5", name: "Sidi Fournitures" }] };

function readOnly(label: string) {
  const field = screen.getByText(label).parentElement;

  if (field === null) {
    throw new Error(`no field for ${label}`);
  }

  return within(field);
}

describe("ResourceChangeForm", () => {
  it("shows the quantity after an increase and records it", async () => {
    const user = userEvent.setup();
    renderChangeForm("increase");

    await user.type(screen.getByLabelText(fields.quantity), "1.5");

    expect(readOnly(fields.quantityAfter).getByText("10")).toBeVisible();

    await user.type(screen.getByLabelText(fields.note), "Achat");
    await user.click(screen.getByRole("button", { name: text.form.increaseSubmit }));

    expect(api.changeResourceQuantity).toHaveBeenCalledWith(
      "2",
      "increase",
      { quantity: 1.5, note: "Achat", fromSupplier: false, supplier: "", price: Number.NaN },
      expect.any(String),
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it("records a decrease as a quantity and a note, with no shipment or refining", async () => {
    const user = userEvent.setup();
    renderChangeForm("decrease");

    expect(screen.queryAllByRole("combobox")).toHaveLength(0);

    await user.type(screen.getByLabelText(fields.quantity), "2");
    await user.click(screen.getByRole("button", { name: text.form.decreaseSubmit }));

    expect(api.changeResourceQuantity).toHaveBeenCalledWith(
      "2",
      "decrease",
      expect.objectContaining({ quantity: 2, note: "", fromSupplier: false }),
      expect.any(String),
    );
  });

  it("refuses to take more than what is left", async () => {
    const user = userEvent.setup();
    renderChangeForm("decrease");

    await user.type(screen.getByLabelText(fields.quantity), "9");
    await user.click(screen.getByRole("button", { name: text.form.decreaseSubmit }));

    expect(await screen.findByText("Il ne reste que 8,5")).toBeVisible();
    expect(api.changeResourceQuantity).not.toHaveBeenCalled();
  });

  it("requires a quantity above zero", async () => {
    const user = userEvent.setup();
    renderChangeForm("increase");

    await user.type(screen.getByLabelText(fields.quantity), "0");
    await user.click(screen.getByRole("button", { name: text.form.increaseSubmit }));

    expect(await screen.findByText(text.errors.changeInvalid)).toBeVisible();
  });

  it("records the supplier and the delivery amount when received from a supplier", async () => {
    const user = userEvent.setup();
    renderChangeForm("increase", supplied);

    expect(screen.queryByLabelText(fields.supplier)).toBeNull();

    await user.type(screen.getByLabelText(fields.quantity), "2");
    await user.click(screen.getByLabelText(text.form.fromSupplier));
    await user.selectOptions(screen.getByLabelText(fields.supplier), "5");
    await user.type(screen.getByLabelText(fields.deliveryPrice), "300");
    await user.click(screen.getByRole("button", { name: text.form.increaseSubmit }));

    expect(api.changeResourceQuantity).toHaveBeenCalledWith(
      "2",
      "increase",
      expect.objectContaining({ quantity: 2, fromSupplier: true, supplier: "5", price: 300 }),
      expect.any(String),
    );
  });

  it("asks the supplier and the amount of an increase received from a supplier", async () => {
    const user = userEvent.setup();
    renderChangeForm("increase", supplied);

    await user.type(screen.getByLabelText(fields.quantity), "2");
    await user.click(screen.getByLabelText(text.form.fromSupplier));
    await user.click(screen.getByRole("button", { name: text.form.increaseSubmit }));

    expect(await screen.findByText(messages.common.validation.required)).toBeVisible();
    expect(screen.getByText(text.errors.priceInvalid)).toBeVisible();
    expect(api.changeResourceQuantity).not.toHaveBeenCalled();
  });

  it("offers no supplier on a decrease", () => {
    renderChangeForm("decrease", supplied);
    expect(screen.queryByLabelText(text.form.fromSupplier)).toBeNull();
  });

  it("offers no supplier for a resource without suppliers", () => {
    renderChangeForm("increase");
    expect(screen.queryByLabelText(text.form.fromSupplier)).toBeNull();
  });
});
