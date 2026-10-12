import { render, screen, within } from "@testing-library/react";
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
  bagsMilled: 4,
};

function renderForm() {
  return render(
    <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
      <RefiningForm
        operation={grinding}
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

async function fillRequired(before: string, after: string, gold: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(fields.bags), "4");
  await user.selectOptions(screen.getByLabelText(fields.worker), "4");
  await user.type(screen.getByLabelText(fields.weightBefore), before);
  await user.type(screen.getByLabelText(fields.weightAfter), after);
  await user.type(screen.getByLabelText(fields.goldWithMaterial), gold);
  await user.type(screen.getByLabelText(fields.goldWithoutMaterial), gold);
  await user.type(screen.getByLabelText(fields.loss), "0");
  await user.selectOptions(screen.getByLabelText(fields.lossReason), "arghawa");
  return user;
}

describe("RefiningForm", () => {
  it("shows the grinding operation it refines and leaves the bags to type", () => {
    renderForm();

    expect(readOnly(fields.shipment).getByText("SH-1052")).toBeVisible();
    expect(readOnly(fields.client).getByText("Mariem")).toBeVisible();
    expect(readOnly(fields.project).getByText("Zouérat 1")).toBeVisible();
    expect(readOnly(fields.machine).getByText("Machine 2")).toBeVisible();
    expect(screen.getByLabelText(fields.bags)).toHaveValue(null);
  });

  it("shows the weight difference as the weights are entered", async () => {
    renderForm();

    await fillRequired("120.5", "118.25", "14.3");

    expect(readOnly(fields.weightLoss).getByText("2,25")).toBeVisible();
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
    expect(api.createRefiningOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        workerId: "4",
        bags: 4,
        weightBefore: 120.5,
        weightAfter: 118.25,
        goldWithMaterial: 20,
        goldWithoutMaterial: 14.3,
        loss: 0,
      }),
      { grindingOperationId: "5", refinedAt: expect.stringMatching(/^2026-10-12T/) },
    );
  });

  it("asks nothing about the material and sends the loss for the backend to take from stock", async () => {
    renderForm();
    const user = await fillRequired("1200", "1150", "14");

    expect(screen.queryByText(/mercur/i)).toBeNull();

    await user.clear(screen.getByLabelText(fields.loss));
    await user.type(screen.getByLabelText(fields.loss), "90");
    await user.click(screen.getByRole("button", { name: text.form.submit }));

    expect(api.createRefiningOperation).toHaveBeenCalledWith(
      expect.objectContaining({ loss: 90 }),
      expect.anything(),
    );
  });

  it("shows on the loss field when the stock cannot cover it", async () => {
    api.createRefiningOperation.mockResolvedValue({
      ok: false,
      fieldErrors: { loss: "Only 50 of this resource is left." },
      failed: false,
    });
    renderForm();
    const user = await fillRequired("1200", "1150", "14");

    await user.clear(screen.getByLabelText(fields.loss));
    await user.type(screen.getByLabelText(fields.loss), "90");
    await user.click(screen.getByRole("button", { name: text.form.submit }));

    expect(await screen.findByText("Only 50 of this resource is left.")).toBeVisible();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("offers the seven loss reasons and sends the chosen one", async () => {
    renderForm();

    expect(
      within(screen.getByLabelText(fields.lossReason))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([
      "Manque normal",
      "Aucune perte",
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

  it("flags every empty required field on submit", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: text.form.submit }));

    expect(await screen.findAllByText(messages.common.validation.required)).toHaveLength(8);
    expect(api.createRefiningOperation).not.toHaveBeenCalled();
  });

  it("refuses more bags than were ground", async () => {
    renderForm();
    const user = await fillRequired("10", "9", "1");

    await user.clear(screen.getByLabelText(fields.bags));
    await user.type(screen.getByLabelText(fields.bags), "5");
    await user.click(screen.getByRole("button", { name: text.form.submit }));

    expect(await screen.findByText("Saisissez un nombre entier de 1 à 4")).toBeVisible();
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
});
