import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "use-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/fr.json";
import { ResourceChangeForm, ResourceForm } from "./InventoryForms";
import type { Resource, ResourceChangeType } from "./resources";

const api = vi.hoisted(() => ({
  createResource: vi.fn(),
  renameResource: vi.fn(),
  changeResourceQuantity: vi.fn(),
}));

vi.mock("./resourcesApi", () => api);

const onSaved = vi.fn();
const text = messages.inventory;
const fields = text.fields;

const mercury: Resource = {
  id: "2",
  project: "3",
  projectName: "Zouérat 1",
  name: "Mercure",
  initialQuantity: 10,
  currentQuantity: 8.5,
  isRefiningMaterial: false,
};

beforeEach(() => {
  onSaved.mockReset();
  for (const mock of Object.values(api)) {
    mock.mockReset();
    mock.mockResolvedValue({ ok: true });
  }
});

function inFrench(children: React.ReactNode) {
  return render(
    <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
      {children}
    </IntlProvider>,
  );
}

function renderResourceForm(resource?: Resource, existing: readonly Resource[] = []) {
  return inFrench(
    <ResourceForm
      resource={resource}
      project={{ id: "3", name: "Zouérat 1" }}
      existing={existing}
      onSaved={onSaved}
      onCancel={vi.fn()}
    />,
  );
}

function renderChangeForm(type: ResourceChangeType) {
  return inFrench(
    <ResourceChangeForm
      resource={mercury}
      type={type}
      refiningOperations={[
        {
          id: "5",
          shipmentNumber: "SH-4",
          client: "Sidi",
          grinderCode: "P3-2",
          projectName: "Zouérat 1",
          workerName: "Aicha",
          bags: 4,
          refinedAt: "2026-10-12T09:30:00Z",
          weightBefore: 120,
          weightAfter: 118,
          weightLoss: 2,
          gold: 14,
          goldWithMaterial: 0,
          goldWithoutMaterial: 0,
          loss: 0,
          lossReason: "",
          notes: "",
        },
      ]}
      onSaved={onSaved}
      onCancel={vi.fn()}
    />,
  );
}

function readOnly(label: string) {
  const field = screen.getByText(label).parentElement;

  if (field === null) {
    throw new Error(`no field for ${label}`);
  }

  return within(field);
}

describe("ResourceForm", () => {
  it("adds another resource under the name typed for it", async () => {
    const user = userEvent.setup();
    renderResourceForm();

    expect(screen.queryByLabelText(fields.name)).toBeNull();

    await user.selectOptions(screen.getByLabelText(fields.kind), "other");
    await user.type(screen.getByLabelText(fields.name), "Chaux");
    await user.type(screen.getByLabelText(fields.initialQuantity), "10.5");
    await user.click(screen.getByRole("button", { name: text.form.create }));

    expect(api.createResource).toHaveBeenCalledWith({
      project: "3",
      kind: "other",
      name: "Chaux",
      initialQuantity: 10.5,
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it("adds the project's mercury by choosing its type, without a name", async () => {
    const user = userEvent.setup();
    renderResourceForm();

    await user.selectOptions(screen.getByLabelText(fields.kind), "mercury");
    expect(screen.queryByLabelText(fields.name)).toBeNull();
    expect(screen.getByText(text.material.hint)).toBeVisible();

    await user.type(screen.getByLabelText(fields.initialQuantity), "500");
    await user.click(screen.getByRole("button", { name: text.form.create }));

    expect(api.createResource).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "mercury", initialQuantity: 500 }),
    );
  });

  it("offers only the types the project does not have yet", () => {
    renderResourceForm(undefined, [{ ...mercury, isRefiningMaterial: true }]);

    expect(
      within(screen.getByLabelText(fields.kind))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([text.kinds.water, text.kinds.fuel, text.kinds.other]);
  });

  it("flags the empty fields", async () => {
    const user = userEvent.setup();
    renderResourceForm();

    await user.click(screen.getByRole("button", { name: text.form.create }));

    expect(await screen.findAllByText(messages.common.validation.required)).toHaveLength(2);
    expect(api.createResource).not.toHaveBeenCalled();
  });

  it("renames another resource, keeping its quantities fixed", async () => {
    const user = userEvent.setup();
    renderResourceForm(mercury);

    expect(readOnly(fields.project).getByText("Zouérat 1")).toBeVisible();
    expect(readOnly(fields.kind).getByText(text.kinds.other)).toBeVisible();
    expect(readOnly(fields.currentQuantity).getByText("8,5")).toBeVisible();
    expect(screen.queryByLabelText(fields.initialQuantity)).toBeNull();

    await user.clear(screen.getByLabelText(fields.name));
    await user.type(screen.getByLabelText(fields.name), "Mercure pur");
    await user.click(screen.getByRole("button", { name: text.form.submit }));

    expect(api.renameResource).toHaveBeenCalledWith("2", "Mercure pur");
  });

  it("shows a type the project already has", async () => {
    api.createResource.mockResolvedValue({
      ok: false,
      fieldErrors: { name: "Existe déjà." },
      failed: false,
    });
    const user = userEvent.setup();
    renderResourceForm();

    await user.selectOptions(screen.getByLabelText(fields.kind), "water");
    await user.type(screen.getByLabelText(fields.initialQuantity), "1");
    await user.click(screen.getByRole("button", { name: text.form.create }));

    expect(await screen.findByText("Existe déjà.")).toBeVisible();
    expect(onSaved).not.toHaveBeenCalled();
  });
});

describe("ResourceChangeForm", () => {
  it("shows the quantity after an increase and records it", async () => {
    const user = userEvent.setup();
    renderChangeForm("increase");

    expect(screen.queryByLabelText(fields.refiningOperation)).toBeNull();

    await user.type(screen.getByLabelText(fields.quantity), "1.5");

    expect(readOnly(fields.quantityAfter).getByText("10")).toBeVisible();

    await user.type(screen.getByLabelText(fields.note), "Achat");
    await user.click(screen.getByRole("button", { name: text.form.increaseSubmit }));

    expect(api.changeResourceQuantity).toHaveBeenCalledWith("2", "increase", {
      quantity: 1.5,
      refiningOperationId: "",
      note: "Achat",
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it("links a decrease to the refining operation that used it", async () => {
    const user = userEvent.setup();
    renderChangeForm("decrease");

    await user.type(screen.getByLabelText(fields.quantity), "2");
    await user.selectOptions(screen.getByLabelText(fields.refiningOperation), "5");
    await user.click(screen.getByRole("button", { name: text.form.decreaseSubmit }));

    expect(api.changeResourceQuantity).toHaveBeenCalledWith("2", "decrease", {
      quantity: 2,
      refiningOperationId: "5",
      note: "",
    });
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
});
