import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/fr.json";
import { formSuppliers, inFrench, text } from "./inventoryTesting";
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

function renderResourceForm({ readable = true }: { readable?: boolean } = {}) {
  return inFrench(
    <ResourceForm
      project={{ id: "3", name: "Zouérat 1" }}
      suppliers={readable ? formSuppliers : undefined}
      onSaved={onSaved}
      onCancel={vi.fn()}
    />,
  );
}

describe("ResourceForm", () => {
  it("adds a resource under the name typed, with its initial quantity", async () => {
    api.createResource.mockResolvedValue({ ok: true, id: "9" });
    const user = userEvent.setup();
    renderResourceForm();

    await user.type(screen.getByLabelText(fields.name), "Chaux");
    await user.type(screen.getByLabelText(fields.initialQuantity), "10.5");
    await user.click(screen.getByRole("button", { name: text.form.create }));

    expect(api.createResource).toHaveBeenCalledWith({
      project: "3",
      name: "Chaux",
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

    await user.type(screen.getByLabelText(fields.name), "Gasoil");
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

    await user.type(screen.getByLabelText(fields.name), "Gasoil");
    await user.type(screen.getByLabelText(fields.initialQuantity), "100");
    await user.selectOptions(screen.getByLabelText(fields.supplier), "5");
    await user.click(screen.getByRole("button", { name: text.form.create }));

    expect(await screen.findByText(text.errors.priceInvalid)).toBeVisible();
    expect(api.createResource).not.toHaveBeenCalled();
  });

  it("asks the supplier only once there is an initial quantity to charge", async () => {
    const user = userEvent.setup();
    renderResourceForm();

    expect(screen.queryByLabelText(fields.supplier)).toBeNull();

    await user.type(screen.getByLabelText(fields.initialQuantity), "4");

    expect(screen.getByLabelText(fields.supplier)).toBeVisible();
  });

  it("leaves the supplier out when the suppliers cannot be read", async () => {
    const user = userEvent.setup();
    renderResourceForm({ readable: false });

    await user.type(screen.getByLabelText(fields.initialQuantity), "4");

    expect(screen.queryByLabelText(fields.supplier)).toBeNull();
  });

  it("adds the project's mercury when its name is typed", async () => {
    const user = userEvent.setup();
    renderResourceForm();

    await user.type(screen.getByLabelText(fields.name), "Mercure");
    expect(screen.getByText(text.material.hint)).toBeVisible();

    await user.type(screen.getByLabelText(fields.initialQuantity), "500");
    await user.click(screen.getByRole("button", { name: text.form.create }));

    expect(api.createResource).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Mercure", initialQuantity: 500 }),
    );
  });

  it("flags the empty fields", async () => {
    const user = userEvent.setup();
    renderResourceForm();

    await user.click(screen.getByRole("button", { name: text.form.create }));

    expect(await screen.findAllByText(messages.common.validation.required)).toHaveLength(2);
    expect(api.createResource).not.toHaveBeenCalled();
  });

  it("shows the backend's refusal of a name the project already has", async () => {
    api.createResource.mockResolvedValue({
      ok: false,
      fieldErrors: { name: "Existe déjà." },
      failed: false,
    });
    const user = userEvent.setup();
    renderResourceForm();

    await user.type(screen.getByLabelText(fields.name), "Chaux");
    await user.type(screen.getByLabelText(fields.initialQuantity), "1");
    await user.click(screen.getByRole("button", { name: text.form.create }));

    expect(await screen.findByText("Existe déjà.")).toBeVisible();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
