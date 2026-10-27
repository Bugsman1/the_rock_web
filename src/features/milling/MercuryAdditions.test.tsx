import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MillingOperation } from "@/lib/grinding";
import messages from "@/messages/fr.json";
import { MercuryAdditionForm, MercuryAdditionsList } from "./MercuryAdditions";
import { EditOperationDrawer } from "./MillingForms";
import { inFrench, running } from "./millingTesting";

const api = vi.hoisted(() => ({ addMercury: vi.fn(), endOperation: vi.fn() }));

vi.mock("./millingApi", () => api);

const mercury = messages.milling.mercury;
const withMercury: MillingOperation = {
  ...running,
  mercury: {
    addedAt: "2026-10-08T07:00:00.000Z",
    byName: "Aicha",
    quantity: 120,
    total: 120,
    additions: [],
  },
};

beforeEach(() => {
  api.addMercury.mockReset();
  api.addMercury.mockResolvedValue({ ok: true });
});

function inRouter(element: ReactNode) {
  return inFrench(<RouterProvider router={createMemoryRouter([{ path: "/", element }])} />);
}

function showDrawer(operation: MillingOperation) {
  return inRouter(
    <EditOperationDrawer
      open
      project={{ id: "3", name: "Zouérat 1", site: "zouerat", status: "active" }}
      operation={operation}
      data={{ machines: [], shipments: [], operations: [operation] }}
      operators={[]}
    />,
  );
}

function showForm(onSaved = vi.fn()) {
  inRouter(<MercuryAdditionForm operationId="42" total={120} onSaved={onSaved} />);
  return { user: userEvent.setup(), onSaved };
}

describe("extra mercury", () => {
  it("adds the typed grams to the total and sends them with the note", async () => {
    const { user, onSaved } = showForm();

    await user.type(screen.getByLabelText(mercury.extraQuantity), "30.5");
    expect(screen.getByText("150,5")).toBeVisible();
    await user.type(screen.getByLabelText(mercury.extraNotes), "Pas assez");
    await user.click(screen.getByRole("button", { name: mercury.extraSubmit }));

    await waitFor(() => {
      expect(api.addMercury).toHaveBeenCalledWith("42", { quantity: 30.5, notes: "Pas assez" });
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it("refuses an empty or zero quantity and sends nothing", async () => {
    const { user } = showForm();

    await user.click(screen.getByRole("button", { name: mercury.extraSubmit }));
    expect(await screen.findByText(mercury.quantityInvalid)).toBeVisible();

    await user.type(screen.getByLabelText(mercury.extraQuantity), "0");
    await user.click(screen.getByRole("button", { name: mercury.extraSubmit }));
    expect(screen.getByText(mercury.quantityInvalid)).toBeVisible();
    expect(api.addMercury).not.toHaveBeenCalled();
  });

  it("shows the backend's reason under the quantity when the stock is too low", async () => {
    api.addMercury.mockResolvedValue({
      ok: false,
      fieldErrors: { quantity: "Pas assez de mercure en stock." },
      failed: false,
    });
    const { user, onSaved } = showForm();

    await user.type(screen.getByLabelText(mercury.extraQuantity), "500");
    await user.click(screen.getByRole("button", { name: mercury.extraSubmit }));

    expect(await screen.findByText("Pas assez de mercure en stock.")).toBeVisible();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("lists each extra mercury with its grams, date, who and note", () => {
    inFrench(
      <MercuryAdditionsList
        additions={[
          {
            id: "3",
            quantity: 30.5,
            addedAt: "2026-10-08T09:00:00Z",
            byName: "Sidi",
            notes: "Pas assez",
          },
        ]}
      />,
    );

    expect(screen.getByText("+30,5 g · 08/10/2026 09:00 · Sidi")).toBeVisible();
    expect(screen.getByText("Pas assez")).toBeVisible();
  });

  it("is offered in the edit drawer once the first mercury is in, while it runs", () => {
    showDrawer(withMercury);

    const dialog = within(
      screen.getByRole("dialog", { name: messages.milling.operation.editTitle }),
    );
    expect(dialog.getByRole("form", { name: mercury.extraTitle })).toBeVisible();
  });

  it("is not offered before the first mercury nor once the grinding ended", () => {
    for (const operation of [running, { ...withMercury, endedAt: "2026-10-08T12:00:00.000Z" }]) {
      const { unmount } = showDrawer(operation);

      expect(screen.queryByRole("form", { name: mercury.extraTitle })).toBeNull();
      unmount();
    }
  });
});
