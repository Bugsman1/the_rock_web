import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/fr.json";
import type { MillingOperation, OperationShipment } from "@/lib/grinding";
import { OperationForm } from "./OperationForm";

const api = vi.hoisted(() => ({ startOperation: vi.fn(), updateOperation: vi.fn() }));

vi.mock("@/lib/grindingApi", () => api);

const onSaved = vi.fn();
const form = messages.milling.operation;

beforeEach(() => {
  onSaved.mockReset();
  api.startOperation.mockReset();
  api.startOperation.mockResolvedValue({ ok: true });
  api.updateOperation.mockReset();
  api.updateOperation.mockResolvedValue({ ok: true });
});

const shipments: OperationShipment[] = [
  {
    id: "52",
    shipmentNumber: "SH-1052",
    client: "Mariem",
    bags: 14,
    remainingBags: 10,
    arrivedAt: "2026-10-07T08:00:00.000Z",
  },
  {
    id: "53",
    shipmentNumber: "SH-1053",
    client: "Abderrahmane",
    bags: 6,
    remainingBags: 1,
    arrivedAt: "2026-10-07T08:00:00.000Z",
  },
];

const idleMachines = [
  { grinderId: "g7", project: "3", number: 7, inMaintenance: false },
  { grinderId: "g10", project: "3", number: 10, inMaintenance: false },
];

function inFrench(children: React.ReactNode) {
  return render(
    <RouterProvider
      router={createMemoryRouter([
        {
          path: "*",
          element: (
            <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
              {children}
            </IntlProvider>
          ),
        },
      ])}
    />,
  );
}

function renderNewOperation(defaults: { shipment?: string; machine?: number } = {}) {
  return inFrench(
    <OperationForm
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

describe("OperationForm", () => {
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

  it("says at once that the bags cannot be more than the shipment has, never a negative count", async () => {
    const user = userEvent.setup();
    renderNewOperation({ shipment: "SH-1053", machine: 7 });

    await user.type(screen.getByLabelText(form.bags), "1.5");

    expect(await screen.findByText(form.errors.bagsTooMany)).toBeVisible();
    expect(screen.getByText(form.remaining.replace("{count}", "1"))).toBeVisible();
    expect(screen.queryByText(/-0,5/)).not.toBeInTheDocument();
  });

  it("says the bags are too many the moment the shipment is chosen after them", async () => {
    const user = userEvent.setup();
    renderNewOperation({ machine: 7 });

    await user.type(screen.getByLabelText(form.bags), "1.5");
    expect(screen.queryByText(form.errors.bagsTooMany)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(form.shipment), "SH-1053");
    await user.click(await screen.findByRole("option", { name: /SH-1053/ }));

    expect(await screen.findByText(form.errors.bagsTooMany)).toBeVisible();
  });

  it("asks for the bags again as soon as the field is emptied", async () => {
    const user = userEvent.setup();
    renderNewOperation({ shipment: "SH-1052", machine: 7 });

    await user.type(screen.getByLabelText(form.bags), "2");
    await user.clear(screen.getByLabelText(form.bags));

    expect(await screen.findByText(messages.common.validation.required)).toBeVisible();
  });

  it("still says a machine takes at most 2 bags at a time", async () => {
    const user = userEvent.setup();
    renderNewOperation({ shipment: "SH-1052", machine: 7 });

    await user.type(screen.getByLabelText(form.bags), "3");

    expect(
      await screen.findByText(form.errors.bagsOverCapacity.replace("{max}", "2")),
    ).toBeVisible();
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

  it("edits a running operation, pre-filled with what was saved", async () => {
    const running: MillingOperation = {
      id: "42",
      project: "3",
      machine: 7,
      shipmentNumber: "SH-1052",
      client: "Mariem",
      bags: 1.5,
      operatorName: "Ahmed",
      startedAt: "2026-10-08T06:00:00.000Z",
      estimatedEndAt: "2026-10-08T10:30:00.000Z",
      notes: "Sacs humides",
    };
    const user = userEvent.setup();
    inFrench(
      <OperationForm
        operation={running}
        projectName="Zouerate 1"
        shipments={shipments}
        idleMachines={idleMachines}
        operators={[{ id: "emp-1", name: "Ahmed" }]}
        defaultShipmentNumber="SH-1052"
        defaultMachine={7}
        defaultDate="2026-10-08"
        defaultTime="06:00"
        onSaved={onSaved}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(form.shipment)).toHaveValue("SH-1052");
    expect(screen.getByLabelText(form.machine)).toHaveValue("7");
    expect(screen.getByLabelText(form.bags)).toHaveValue(1.5);
    expect(screen.getByLabelText(form.operator)).toHaveValue("emp-1");
    expect(screen.getByLabelText(form.notes)).toHaveValue("Sacs humides");

    await user.clear(screen.getByLabelText(form.bags));
    await user.type(screen.getByLabelText(form.bags), "2");
    await user.selectOptions(screen.getByLabelText(form.machine), "10");
    await user.click(screen.getByRole("button", { name: form.saveChanges }));

    await waitFor(() => {
      expect(api.updateOperation).toHaveBeenCalledWith(
        "42",
        expect.objectContaining({ bags: 2, machine: "10", operatorId: "emp-1" }),
        { shipmentId: "52", grinderId: "g10", startedAt: "2026-10-08T06:00:00.000Z" },
      );
    });
    expect(api.startOperation).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
  });

  it("shows the start it records and refuses one before the shipment arrived", async () => {
    const user = userEvent.setup();
    inFrench(
      <OperationForm
        projectName="Zouerate 1"
        shipments={[
          {
            id: "52",
            shipmentNumber: "SH-1052",
            client: "Mariem",
            bags: 14,
            remainingBags: 10,
            arrivedAt: "2026-10-09T08:00:00.000Z",
          },
        ]}
        idleMachines={idleMachines}
        operators={[{ id: "emp-1", name: "Ahmed" }]}
        defaultShipmentNumber="SH-1052"
        defaultMachine={7}
        defaultDate="2026-10-08"
        defaultTime="08:00"
        onSaved={onSaved}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText(form.startTime)).not.toBeInTheDocument();
    expect(screen.getByText(form.startTime).nextSibling).toHaveTextContent("08:00");

    await user.type(screen.getByLabelText(form.bags), "2");
    await user.selectOptions(screen.getByLabelText(form.operator), "emp-1");
    await user.click(screen.getByRole("button", { name: form.submit }));

    expect(await screen.findByText(form.errors.startBeforeArrival)).toBeVisible();
    expect(api.startOperation).not.toHaveBeenCalled();
  });
});
