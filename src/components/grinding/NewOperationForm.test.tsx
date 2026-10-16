import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "use-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/fr.json";
import type { OperationShipment } from "@/lib/grinding";
import { NewOperationForm } from "./NewOperationForm";

const api = vi.hoisted(() => ({ startOperation: vi.fn() }));

vi.mock("@/lib/grindingApi", () => api);

const onSaved = vi.fn();
const form = messages.milling.operation;

beforeEach(() => {
  onSaved.mockReset();
  api.startOperation.mockReset();
  api.startOperation.mockResolvedValue({ ok: true });
});

const shipments: OperationShipment[] = [
  {
    id: "52",
    shipmentNumber: "SH-1052",
    client: "Mariem",
    bags: 14,
    remainingBags: 10,
    pending: true,
  },
  {
    id: "53",
    shipmentNumber: "SH-1053",
    client: "Abderrahmane",
    bags: 6,
    remainingBags: 1,
    pending: false,
  },
];

const idleMachines = [
  { grinderId: "g7", project: "3", number: 7, inMaintenance: false },
  { grinderId: "g10", project: "3", number: 10, inMaintenance: false },
];

function inFrench(children: React.ReactNode) {
  return render(
    <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
      {children}
    </IntlProvider>,
  );
}

function renderNewOperation(defaults: { shipment?: string; machine?: number } = {}) {
  return inFrench(
    <NewOperationForm
      projectName="Zouerate 1"
      shipments={shipments}
      idleMachines={idleMachines}
      operators={[{ id: "emp-1", name: "Ahmed" }]}
      defaultShipmentNumber={defaults.shipment}
      defaultMachine={defaults.machine}
      defaultDate="2026-10-08"
      defaultTime="08:00"
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

describe("NewOperationForm", () => {
  it("pre-fills the machine when opened from an idle row", () => {
    renderNewOperation({ machine: 10 });

    expect(screen.getByLabelText(form.machine)).toHaveValue("10");
    expect(screen.getByLabelText(form.shipment)).toHaveValue("");
  });

  it("ignores a pre-filled machine that is not idle", () => {
    renderNewOperation({ machine: 3 });

    expect(screen.getByLabelText(form.machine)).toHaveValue("");
  });

  it("pre-fills the shipment, client and project when opened from the queue", () => {
    renderNewOperation({ shipment: "SH-1052" });

    expect(screen.getByLabelText(form.shipment)).toHaveValue("SH-1052");
    expect(readOnly(form.client).getByText("Mariem")).toBeVisible();
    expect(readOnly(form.project).getByText("Zouerate 1")).toBeVisible();
  });

  it("shows what remains after the operation and the estimated end", async () => {
    const user = userEvent.setup();
    renderNewOperation({ shipment: "SH-1052" });

    expect(screen.getByText("Restants : 10")).toBeVisible();

    await user.type(screen.getByLabelText(form.bags), "4");

    expect(screen.getByText("Restants après cette opération : 6")).toBeVisible();
    expect(screen.getByText("08/10/2026 20:00")).toBeVisible();
  });

  it("flags every empty required field on submit", async () => {
    const user = userEvent.setup();
    renderNewOperation();

    await user.click(screen.getByRole("button", { name: form.submit }));

    expect(await screen.findAllByText(messages.common.validation.required)).toHaveLength(4);
    expect(api.startOperation).not.toHaveBeenCalled();
  });

  it("takes at most 2 bags on a machine, by half bags", async () => {
    const user = userEvent.setup();
    renderNewOperation({ shipment: "SH-1052", machine: 7 });

    const bags = screen.getByLabelText(form.bags);
    await user.selectOptions(screen.getByLabelText(form.operator), "emp-1");
    await user.type(bags, "3");

    expect(
      await screen.findByText(form.errors.bagsOverCapacity.replace("{max}", "2")),
    ).toBeVisible();

    for (const value of ["0.7", "0"]) {
      await user.clear(bags);
      await user.type(bags, value);

      expect(await screen.findByText(form.errors.bagsInvalid)).toBeVisible();
    }
    await user.click(screen.getByRole("button", { name: form.submit }));
    expect(api.startOperation).not.toHaveBeenCalled();

    await user.clear(bags);
    await user.type(bags, "1.5");
    await user.click(screen.getByRole("button", { name: form.submit }));

    await waitFor(() => {
      expect(api.startOperation).toHaveBeenCalledWith(
        expect.objectContaining({ bags: 1.5 }),
        expect.anything(),
      );
    });
  });

  it("rejects more bags than remain on the shipment", async () => {
    const user = userEvent.setup();
    renderNewOperation({ shipment: "SH-1053", machine: 7 });

    await user.type(screen.getByLabelText(form.bags), "1.5");
    await user.selectOptions(screen.getByLabelText(form.operator), "emp-1");
    await user.click(screen.getByRole("button", { name: form.submit }));

    expect(await screen.findByText(form.errors.bagsTooMany)).toBeVisible();
    expect(api.startOperation).not.toHaveBeenCalled();
  });

  it("starts the operation on the chosen machine and shipment", async () => {
    const user = userEvent.setup();
    renderNewOperation({ shipment: "SH-1052", machine: 7 });

    await user.type(screen.getByLabelText(form.bags), "2");
    await user.selectOptions(screen.getByLabelText(form.operator), "emp-1");
    await user.click(screen.getByRole("button", { name: form.submit }));

    await waitFor(() => {
      expect(api.startOperation).toHaveBeenCalledWith(
        expect.objectContaining({ bags: 2, operatorId: "emp-1", machine: "7" }),
        {
          shipmentId: "52",
          grinderId: "g7",
          startedAt: "2026-10-08T08:00:00.000Z",
          shipmentPending: true,
        },
      );
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it("shows the backend's error on its field and stays open", async () => {
    api.startOperation.mockResolvedValue({
      ok: false,
      fieldErrors: { bags: "Plus que les sacs restants." },
      failed: false,
    });
    const user = userEvent.setup();
    renderNewOperation({ shipment: "SH-1052", machine: 7 });

    await user.type(screen.getByLabelText(form.bags), "2");
    await user.selectOptions(screen.getByLabelText(form.operator), "emp-1");
    await user.click(screen.getByRole("button", { name: form.submit }));

    expect(await screen.findByText("Plus que les sacs restants.")).toBeVisible();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
