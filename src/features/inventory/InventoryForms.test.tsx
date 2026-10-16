import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "use-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/fr.json";
import { ResourceChangeForm, ResourceForm } from "./InventoryForms";
import type { Resource, ResourceChangeType } from "./resources";

const api = vi.hoisted(() => ({
  createResource: vi.fn(),
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
  kind: "mercury",
  initialQuantity: 10,
  currentQuantity: 8.5,
  isRefiningMaterial: true,
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

function renderResourceForm(existing: readonly Resource[] = []) {
  return inFrench(
    <ResourceForm
      project={{ id: "3", name: "Zouérat 1" }}
      existing={existing}
      onSaved={onSaved}
      onCancel={vi.fn()}
    />,
  );
}

function renderChangeForm(type: ResourceChangeType) {
  return inFrench(
    <ResourceChangeForm resource={mercury} type={type} onSaved={onSaved} onCancel={vi.fn()} />,
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
  it("adds water with its initial quantity", async () => {
    api.createResource.mockResolvedValue({ ok: true, id: "9" });
    const user = userEvent.setup();
    renderResourceForm();

    await user.selectOptions(screen.getByLabelText(fields.kind), "water");
    await user.type(screen.getByLabelText(fields.initialQuantity), "10.5");
    await user.click(screen.getByRole("button", { name: text.form.create }));

    expect(api.createResource).toHaveBeenCalledWith({
      project: "3",
      kind: "water",
      initialQuantity: 10.5,
    });
    expect(onSaved).toHaveBeenCalledWith("9");
  });

  it("adds the project's mercury by choosing its type", async () => {
    const user = userEvent.setup();
    renderResourceForm();

    await user.selectOptions(screen.getByLabelText(fields.kind), "mercury");
    expect(screen.getByText(text.material.hint)).toBeVisible();

    await user.type(screen.getByLabelText(fields.initialQuantity), "500");
    await user.click(screen.getByRole("button", { name: text.form.create }));

    expect(api.createResource).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "mercury", initialQuantity: 500 }),
    );
  });

  it("offers only mercury, water and fuel the project does not have yet", () => {
    renderResourceForm([mercury]);

    expect(
      within(screen.getByLabelText(fields.kind))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([text.kinds.water, text.kinds.fuel]);
  });

  it("flags the empty fields", async () => {
    const user = userEvent.setup();
    renderResourceForm();

    await user.click(screen.getByRole("button", { name: text.form.create }));

    expect(await screen.findAllByText(messages.common.validation.required)).toHaveLength(2);
    expect(api.createResource).not.toHaveBeenCalled();
  });

  it("shows a type the project already has", async () => {
    api.createResource.mockResolvedValue({
      ok: false,
      fieldErrors: { kind: "Existe déjà." },
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

    await user.type(screen.getByLabelText(fields.quantity), "1.5");

    expect(readOnly(fields.quantityAfter).getByText("10")).toBeVisible();

    await user.type(screen.getByLabelText(fields.note), "Achat");
    await user.click(screen.getByRole("button", { name: text.form.increaseSubmit }));

    expect(api.changeResourceQuantity).toHaveBeenCalledWith("2", "increase", {
      quantity: 1.5,
      note: "Achat",
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it("records a decrease as a quantity and a note, with no shipment or refining", async () => {
    const user = userEvent.setup();
    renderChangeForm("decrease");

    expect(screen.queryAllByRole("combobox")).toHaveLength(0);

    await user.type(screen.getByLabelText(fields.quantity), "2");
    await user.click(screen.getByRole("button", { name: text.form.decreaseSubmit }));

    expect(api.changeResourceQuantity).toHaveBeenCalledWith("2", "decrease", {
      quantity: 2,
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
