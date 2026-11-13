import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/fr.json";
import { formSuppliers, inFrench, kinds, mercuryResource, text } from "./inventoryTesting";
import type { Resource } from "./resources";
import { ResourceForm } from "./ResourceForm";

const api = vi.hoisted(() => ({
  createResource: vi.fn(),
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

function renderResourceForm(
  existing: readonly Resource[] = [],
  { readable = true }: { readable?: boolean } = {},
) {
  return inFrench(
    <ResourceForm
      project={{ id: "3", name: "Zouérat 1" }}
      existing={existing}
      suppliers={readable ? formSuppliers : undefined}
      onSaved={onSaved}
      onCancel={vi.fn()}
    />,
  );
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
      supplier: "",
      initialPrice: Number.NaN,
    });
    expect(onSaved).toHaveBeenCalledWith("9");
  });

  it("charges the initial quantity to the chosen supplier at its price", async () => {
    api.createResource.mockResolvedValue({ ok: true, id: "9" });
    const user = userEvent.setup();
    renderResourceForm();

    expect(screen.queryByLabelText(fields.initialPrice)).toBeNull();

    await user.selectOptions(screen.getByLabelText(fields.kind), "fuel");
    await user.type(screen.getByLabelText(fields.initialQuantity), "100");
    await user.selectOptions(screen.getByLabelText(fields.supplier), "5");
    await user.type(screen.getByLabelText(fields.initialPrice), "300");
    await user.click(screen.getByRole("button", { name: text.form.create }));

    expect(api.createResource).toHaveBeenCalledWith(
      expect.objectContaining({ supplier: "5", initialQuantity: 100, initialPrice: 300 }),
    );
  });

  it("asks the price of an initial quantity that comes from a supplier", async () => {
    const user = userEvent.setup();
    renderResourceForm();

    await user.selectOptions(screen.getByLabelText(fields.kind), "fuel");
    await user.type(screen.getByLabelText(fields.initialQuantity), "100");
    await user.selectOptions(screen.getByLabelText(fields.supplier), "5");
    await user.click(screen.getByRole("button", { name: text.form.create }));

    expect(await screen.findByText(text.errors.priceInvalid)).toBeVisible();
    expect(api.createResource).not.toHaveBeenCalled();
  });

  it("leaves the supplier out when the suppliers cannot be read", () => {
    renderResourceForm([], { readable: false });

    expect(screen.queryByLabelText(fields.supplier)).toBeNull();
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
    ).toEqual([kinds.water, kinds.fuel]);
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
