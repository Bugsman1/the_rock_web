import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formSuppliers, inFrench, mercuryResource, text } from "./inventoryTesting";
import { ResourceSupplierForm } from "./ResourceSupplierForm";

const api = vi.hoisted(() => ({
  changeResourceSupplier: vi.fn(),
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
const suppliers = formSuppliers;

describe("ResourceSupplierForm", () => {
  it("gives the resource its supplier", async () => {
    api.changeResourceSupplier.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    inFrench(
      <ResourceSupplierForm
        resource={mercury}
        suppliers={suppliers}
        onSaved={onSaved}
        onCancel={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByLabelText(fields.supplier), "5");
    await user.click(screen.getByRole("button", { name: text.form.supplierSubmit }));

    expect(api.changeResourceSupplier).toHaveBeenCalledWith(mercury, { supplier: "5" });
    expect(onSaved).toHaveBeenCalled();
  });

  it("shows the backend's refusal on the supplier", async () => {
    api.changeResourceSupplier.mockResolvedValue({
      ok: false,
      fieldErrors: { supplier: "Fournisseur inactif." },
      failed: false,
    });
    const user = userEvent.setup();
    inFrench(
      <ResourceSupplierForm
        resource={mercury}
        suppliers={suppliers}
        onSaved={onSaved}
        onCancel={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByLabelText(fields.supplier), "5");
    await user.click(screen.getByRole("button", { name: text.form.supplierSubmit }));

    expect(await screen.findByText("Fournisseur inactif.")).toBeVisible();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
