import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { noAccess } from "@/lib/access";
import type { Access } from "@/lib/access";
import type { MillingOperation } from "@/lib/grinding";
import messages from "@/messages/fr.json";
import {
  fillRefiningForm,
  grindingToRefine,
  readOnlyField,
  refiningAdmin,
  renderRefiningForm,
} from "./refiningTesting";

const api = vi.hoisted(() => ({ createRefiningOperation: vi.fn() }));

vi.mock("./refiningApi", () => api);

const onSaved = vi.fn();
const text = messages.refining;
const fields = text.fields;

beforeEach(() => {
  onSaved.mockReset();
  api.createRefiningOperation.mockReset();
  api.createRefiningOperation.mockResolvedValue({ ok: true });
});

function renderForm(
  operation: MillingOperation = grindingToRefine,
  access: Access = refiningAdmin,
) {
  return renderRefiningForm(operation, access, onSaved);
}

describe("RefiningForm", () => {
  it("shows the grindingToRefine it refines and refines exactly the bags ground", () => {
    renderForm();

    expect(readOnlyField(fields.shipment).getByText("SH-1052")).toBeVisible();
    expect(readOnlyField(fields.client).getByText("Mariem")).toBeVisible();
    expect(readOnlyField(fields.project).getByText("Zouérat 1")).toBeVisible();
    expect(readOnlyField(fields.machine).getByText("Machine 2")).toBeVisible();
    expect(readOnlyField(fields.operator).getByText("Ahmed")).toBeVisible();
    expect(readOnlyField(fields.bagsGround).getByText("4")).toBeVisible();
    expect(readOnlyField(fields.groundFrom).getByText("12/10/2026 06:00")).toBeVisible();
    expect(readOnlyField(fields.groundAt).getByText("12/10/2026 18:00")).toBeVisible();
    expect(screen.queryByRole("spinbutton", { name: fields.bags })).toBeNull();
    expect(screen.queryByText(/Écart de poids/)).toBeNull();
  });

  it("records the refining of the grindingToRefine operation and closes", async () => {
    renderForm();
    const user = await fillRefiningForm("120.5", "118.25", "14.3");

    await user.clear(screen.getByLabelText(fields.goldWithMaterial));
    await user.type(screen.getByLabelText(fields.goldWithMaterial), "20");
    await user.clear(screen.getByLabelText(fields.goldWithoutMaterial));
    await user.type(screen.getByLabelText(fields.goldWithoutMaterial), "14.3");
    await user.click(screen.getByRole("button", { name: text.form.submit }));

    expect(onSaved).toHaveBeenCalled();
    expect(screen.getByRole("status", { name: text.form.saving })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: text.form.submit })).toBeNull();
    expect(api.createRefiningOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        workerId: "4",
        weightBefore: 120.5,
        weightAfter: 118.25,
        goldWithMaterial: 20,
        goldWithoutMaterial: 14.3,
      }),
      { grindingOperationId: "5", refinedAt: expect.stringMatching(/^2026-10-12T/) },
    );
  });

  it("records a non-admin as the responsible worker without asking", async () => {
    const user = userEvent.setup();
    renderForm(grindingToRefine, { ...noAccess, userId: "9" });

    expect(screen.queryByLabelText(fields.worker)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(fields.weightBefore), "10");
    await user.type(screen.getByLabelText(fields.weightAfter), "10");
    await user.type(screen.getByLabelText(fields.goldWithMaterial), "2");
    await user.click(screen.getByRole("button", { name: text.form.submit }));

    await waitFor(() => {
      expect(api.createRefiningOperation).toHaveBeenCalledWith(
        expect.objectContaining({ workerId: "9" }),
        expect.anything(),
      );
    });
  });

  it("shows on the loss field when the stock cannot cover it", async () => {
    api.createRefiningOperation.mockResolvedValue({
      ok: false,
      fieldErrors: { loss: "Only 50 of this resource is left." },
      failed: false,
    });
    renderForm();
    const user = await fillRefiningForm("1200", "1100", "14");

    await user.click(screen.getByRole("button", { name: text.form.submit }));

    expect(await screen.findByText("Only 50 of this resource is left.")).toBeVisible();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("flags every empty required field on submit", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: text.form.submit }));

    expect(await screen.findAllByText(messages.common.validation.required)).toHaveLength(5);
    expect(api.createRefiningOperation).not.toHaveBeenCalled();
  });

  it("shows the backend's refusal on its field", async () => {
    api.createRefiningOperation.mockResolvedValue({
      ok: false,
      fieldErrors: { workerId: "Pas de ce projet." },
      failed: false,
    });
    renderForm();
    const user = await fillRefiningForm("10", "9", "1");

    await user.click(screen.getByRole("button", { name: text.form.submit }));

    expect(await screen.findByText("Pas de ce projet.")).toBeVisible();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("reports a failed save", async () => {
    api.createRefiningOperation.mockResolvedValue({ ok: false, fieldErrors: {}, failed: true });
    renderForm();
    const user = await fillRefiningForm("10", "9", "1");

    await user.click(screen.getByRole("button", { name: text.form.submit }));

    expect(await screen.findByText(messages.common.saveFailed)).toBeVisible();
  });

  it("says at once that the gold without material must be less than with it", async () => {
    renderForm();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(fields.goldWithMaterial), "20");
    await user.type(screen.getByLabelText(fields.goldWithoutMaterial), "20");
    expect(await screen.findByText(text.errors.withoutMaterialTooHeavy)).toBeVisible();

    await user.clear(screen.getByLabelText(fields.goldWithMaterial));
    await user.type(screen.getByLabelText(fields.goldWithMaterial), "25");
    await waitFor(() => {
      expect(screen.queryByText(text.errors.withoutMaterialTooHeavy)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: text.form.submit }));
    expect(api.createRefiningOperation).not.toHaveBeenCalled();
  });
});
