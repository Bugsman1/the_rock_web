import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "use-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MillingOperation } from "@/lib/grinding";
import messages from "@/messages/fr.json";
import { RefiningForm } from "./RefiningForm";

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

const grinding: MillingOperation = {
  id: "5",
  project: "3",
  machine: 2,
  shipmentNumber: "SH-1052",
  client: "Mariem",
  bags: 4,
  operatorName: "Ahmed",
  startedAt: "2026-10-12T06:00:00Z",
  estimatedEndAt: "2026-10-12T18:00:00Z",
  notes: "",
  endedAt: "2026-10-12T18:00:00Z",
};

function renderForm(operation: MillingOperation = grinding) {
  return render(
    <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
      <RefiningForm
        operation={operation}
        projectName="Zouérat 1"
        workers={[{ id: "4", name: "Aicha" }]}
        defaultDate="2026-10-12"
        defaultTime="09:30"
        onSaved={onSaved}
        onCancel={vi.fn()}
      />
    </IntlProvider>,
  );
}

function readOnly(label: string) {
  const field = screen.getByText(label).parentElement;

  if (field === null) {
    throw new Error(`no field for ${label}`);
  }

  return within(field);
}

async function fillRequired(before: string, after: string, goldWithout: string) {
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText(fields.worker), "4");
  await user.type(screen.getByLabelText(fields.weightBefore), before);
  await user.type(screen.getByLabelText(fields.weightAfter), after);
  await user.type(screen.getByLabelText(fields.goldWithMaterial), String(Number(goldWithout) + 1));
  await user.type(screen.getByLabelText(fields.goldWithoutMaterial), goldWithout);
  await user.selectOptions(screen.getByLabelText(fields.lossReason), "arghawa");
  return user;
}

describe("RefiningForm", () => {
  it("fills the weight before refining with the mercury added to the grinding", () => {
    renderForm({
      ...grinding,
      mercury: { addedAt: "2026-10-12T07:00:00Z", byName: "Aicha", quantity: 120.5 },
    });

    const weightBefore = screen.getByLabelText(fields.weightBefore);
    expect(weightBefore).toHaveValue(120.5);
    expect(weightBefore).toHaveAttribute("readonly");
  });

  it("lets the weight before be typed when the grinding has no mercury quantity", () => {
    renderForm();

    const weightBefore = screen.getByLabelText(fields.weightBefore);
    expect(weightBefore).toHaveValue(null);
    expect(weightBefore).not.toHaveAttribute("readonly");
  });

  it("shows the grinding it refines and refines exactly the bags ground", () => {
    renderForm();

    expect(readOnly(fields.shipment).getByText("SH-1052")).toBeVisible();
    expect(readOnly(fields.client).getByText("Mariem")).toBeVisible();
    expect(readOnly(fields.project).getByText("Zouérat 1")).toBeVisible();
    expect(readOnly(fields.machine).getByText("Machine 2")).toBeVisible();
    expect(readOnly(fields.operator).getByText("Ahmed")).toBeVisible();
    expect(readOnly(fields.bagsGround).getByText("4")).toBeVisible();
    expect(readOnly(fields.groundFrom).getByText("12/10/2026 06:00")).toBeVisible();
    expect(readOnly(fields.groundAt).getByText("12/10/2026 18:00")).toBeVisible();
    expect(screen.queryByRole("spinbutton", { name: fields.bags })).toBeNull();
    expect(screen.queryByText(/Écart de poids/)).toBeNull();
  });

  it("records the refining of the grinding operation and closes", async () => {
    renderForm();
    const user = await fillRequired("120.5", "118.25", "14.3");

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

  it("works out the loss from the weights, without asking it", async () => {
    renderForm();

    expect(readOnly(fields.loss).getByText("—")).toBeVisible();

    await fillRequired("1200", "1150.5", "14");

    expect(readOnly(fields.loss).getByText("49,5")).toBeVisible();
    expect(screen.queryByRole("spinbutton", { name: fields.loss })).toBeNull();
    expect(screen.queryByText(/mercur/i)).toBeNull();
  });

  it("shows on the loss field when the stock cannot cover it", async () => {
    api.createRefiningOperation.mockResolvedValue({
      ok: false,
      fieldErrors: { loss: "Only 50 of this resource is left." },
      failed: false,
    });
    renderForm();
    const user = await fillRequired("1200", "1100", "14");

    await user.click(screen.getByRole("button", { name: text.form.submit }));

    expect(await screen.findByText("Only 50 of this resource is left.")).toBeVisible();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("offers the loss reasons and sends the chosen one", async () => {
    renderForm();

    expect(
      within(screen.getByLabelText(fields.lossReason))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([
      "Manque normal",
      "Erreur de pesée",
      "Panne ou fuite de la machine",
      "Mélange avec la terre",
      "Arghawa",
      "Négligence d'un ouvrier",
    ]);

    const user = await fillRequired("10", "9", "1");
    await user.click(screen.getByRole("button", { name: text.form.submit }));

    expect(api.createRefiningOperation).toHaveBeenCalledWith(
      expect.objectContaining({ lossReason: "arghawa" }),
      expect.anything(),
    );
  });

  it("hides the loss and its reason when nothing was lost", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(fields.weightBefore), "10");
    await user.type(screen.getByLabelText(fields.weightAfter), "10");

    expect(screen.queryByText(fields.loss)).toBeNull();
    expect(screen.queryByLabelText(fields.lossReason)).toBeNull();

    await user.clear(screen.getByLabelText(fields.weightAfter));
    await user.type(screen.getByLabelText(fields.weightAfter), "9");

    expect(screen.getByText(fields.loss)).toBeVisible();
    expect(screen.getByLabelText(fields.lossReason)).toBeVisible();
  });

  it("flags every empty required field on submit", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: text.form.submit }));

    expect(await screen.findAllByText(messages.common.validation.required)).toHaveLength(6);
    expect(api.createRefiningOperation).not.toHaveBeenCalled();
  });

  it("shows the backend's refusal on its field", async () => {
    api.createRefiningOperation.mockResolvedValue({
      ok: false,
      fieldErrors: { workerId: "Pas de ce projet." },
      failed: false,
    });
    renderForm();
    const user = await fillRequired("10", "9", "1");

    await user.click(screen.getByRole("button", { name: text.form.submit }));

    expect(await screen.findByText("Pas de ce projet.")).toBeVisible();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("reports a failed save", async () => {
    api.createRefiningOperation.mockResolvedValue({ ok: false, fieldErrors: {}, failed: true });
    renderForm();
    const user = await fillRequired("10", "9", "1");

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

  it("says at once that the mercury after refining cannot weigh more than before", async () => {
    renderForm({
      ...grinding,
      mercury: { addedAt: "2026-10-12T07:00:00Z", byName: "Aicha", quantity: 120 },
    });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(fields.weightAfter), "130");

    expect(await screen.findByText(text.errors.weightAfterTooHigh)).toBeVisible();

    await user.click(screen.getByRole("button", { name: text.form.submit }));
    expect(api.createRefiningOperation).not.toHaveBeenCalled();
  });
});
