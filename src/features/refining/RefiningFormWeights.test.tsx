import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/fr.json";
import {
  fillRefiningForm,
  grindingToRefine,
  readOnlyField,
  renderRefiningForm,
} from "./refiningTesting";

const api = vi.hoisted(() => ({ createRefiningOperation: vi.fn() }));

vi.mock("./refiningApi", () => api);

const text = messages.refining;
const fields = text.fields;

beforeEach(() => {
  api.createRefiningOperation.mockReset();
  api.createRefiningOperation.mockResolvedValue({ ok: true });
});

const renderForm = renderRefiningForm;

describe("RefiningForm weights, loss and surplus", () => {
  it("starts the weight before refining from all the mercury, the extra included", () => {
    renderForm({
      ...grindingToRefine,
      mercury: {
        addedAt: "2026-10-12T07:00:00Z",
        byName: "Aicha",
        quantity: 120,
        total: 150.5,
        additions: [
          {
            id: "3",
            quantity: 30.5,
            addedAt: "2026-10-12T09:00:00Z",
            byName: "Sidi",
            notes: "",
          },
        ],
      },
    });

    expect(screen.getByLabelText(fields.weightBefore)).toHaveValue(150.5);
  });

  it("fills the weight before refining with the mercury added to the grindingToRefine", () => {
    renderForm({
      ...grindingToRefine,
      mercury: {
        addedAt: "2026-10-12T07:00:00Z",
        byName: "Aicha",
        quantity: 120.5,
        total: 120.5,
        additions: [],
      },
    });

    const weightBefore = screen.getByLabelText(fields.weightBefore);
    expect(weightBefore).toHaveValue(120.5);
    expect(weightBefore).toHaveAttribute("readonly");
  });

  it("lets the weight before be typed when the grindingToRefine has no mercury quantity", () => {
    renderForm();

    const weightBefore = screen.getByLabelText(fields.weightBefore);
    expect(weightBefore).toHaveValue(null);
    expect(weightBefore).not.toHaveAttribute("readonly");
  });

  it("works out the loss from the weights, without asking it", async () => {
    renderForm();

    expect(readOnlyField(fields.loss).getByText("—")).toBeVisible();

    await fillRefiningForm("1200", "1150.5", "14");

    expect(readOnlyField(fields.loss).getByText("49,5")).toBeVisible();
    expect(screen.queryByRole("spinbutton", { name: fields.loss })).toBeNull();
    expect(screen.queryByText(/mercur/i)).toBeNull();
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

    const user = await fillRefiningForm("10", "9", "1");
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

  it("shows a surplus, not a loss, when more mercury comes back, and saves it with no reason", async () => {
    renderForm({
      ...grindingToRefine,
      mercury: {
        addedAt: "2026-10-12T07:00:00Z",
        byName: "Aicha",
        quantity: 120,
        total: 120,
        additions: [],
      },
    });
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText(fields.worker), "4");
    await user.type(screen.getByLabelText(fields.weightAfter), "130");
    await user.type(screen.getByLabelText(fields.goldWithMaterial), "2");

    expect(readOnlyField(fields.surplus).getByText("+10")).toBeVisible();
    expect(screen.queryByText(fields.loss)).toBeNull();
    expect(screen.queryByLabelText(fields.lossReason)).toBeNull();

    await user.click(screen.getByRole("button", { name: text.form.submit }));
    expect(api.createRefiningOperation).toHaveBeenCalledWith(
      expect.objectContaining({ weightBefore: 120, weightAfter: 130 }),
      expect.anything(),
    );
  });
});
