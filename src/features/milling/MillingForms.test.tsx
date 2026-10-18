import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { noAccess, rightsFromApi } from "@/lib/access";
import type { Access } from "@/lib/access";
import { AccessContext } from "@/lib/accessContext";
import messages from "@/messages/fr.json";
import type { MillingOperation } from "@/lib/grinding";
import { EndMillingAction, MercuryStatus } from "./MillingForms";

const allRights: Access = { ...noAccess, superuser: true };

const api = vi.hoisted(() => ({ endOperation: vi.fn(), markMercuryAdded: vi.fn() }));

vi.mock("./millingApi", () => api);

const end = messages.milling.end;

beforeEach(() => {
  api.endOperation.mockReset();
  api.endOperation.mockResolvedValue({ ok: true });
  api.markMercuryAdded.mockReset();
  api.markMercuryAdded.mockResolvedValue({ ok: true });
});

function inFrench(children: React.ReactNode, access: Access = allRights) {
  return render(
    <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
      <AccessContext value={access}>{children}</AccessContext>
    </IntlProvider>,
  );
}

const running: MillingOperation = {
  id: "42",
  project: "3",
  machine: 7,
  shipmentNumber: "SH-1052",
  client: "Mariem",
  bags: 2,
  operatorName: "Ahmed",
  startedAt: "2026-10-08T06:00:00.000Z",
  estimatedEndAt: "2026-10-08T12:00:00.000Z",
  notes: "",
};

async function openEndMilling(access: Access = allRights) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <EndMillingAction
            label="Terminer"
            title={end.title}
            closeLabel={messages.common.close}
            operation={running}
            shipmentId="52"
            statusAfterEnd={() => "completed"}
            defaultDate="2026-10-08"
            defaultTime="12:30"
          />
        ),
      },
      { path: "/fr/refining", element: <h1>refining page</h1> },
    ],
    { initialEntries: ["/"] },
  );
  const user = userEvent.setup();

  inFrench(<RouterProvider router={router} />, access);
  await user.click(screen.getByRole("button", { name: "Terminer" }));

  return { user, router };
}

describe("ending a milling operation", () => {
  it("rejects an end before the start", async () => {
    const { user } = await openEndMilling();

    const time = screen.getByLabelText(end.endTime);
    await user.clear(time);
    await user.type(time, "0500");
    await user.click(screen.getByRole("button", { name: end.submit }));

    expect(await screen.findByText(end.errors.endBeforeStart)).toBeVisible();
    expect(api.endOperation).not.toHaveBeenCalled();
  });

  it("ends the operation with the shipment's next status and opens its refining", async () => {
    const { user, router } = await openEndMilling();

    await user.click(screen.getByRole("button", { name: end.submit }));

    await waitFor(() => {
      expect(api.endOperation).toHaveBeenCalledWith(
        running,
        "52",
        { endDate: "2026-10-08", endTime: "12:30", notes: "" },
        "2026-10-08T12:30:00.000Z",
        "completed",
      );
    });
    expect(await screen.findByRole("heading", { name: "refining page" })).toBeVisible();
    expect(`${router.state.location.pathname}${router.state.location.search}`).toBe(
      "/fr/refining?grinding=42",
    );
  });

  it("stays on the machine when the role may not start the refining", async () => {
    const { user, router } = await openEndMilling({
      superuser: false,
      rights: rightsFromApi([
        { module: "grinding", can_view: true, can_edit: true },
        { module: "refining", can_view: true },
      ]),
    });

    await user.click(screen.getByRole("button", { name: end.submit }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(api.endOperation).toHaveBeenCalled();
    expect(router.state.location.pathname).toBe("/");
  });
});

const mercury = messages.milling.mercury;

function showMercury(operation: MillingOperation, access: Access = allRights) {
  const router = createMemoryRouter([
    { path: "/", element: <MercuryStatus operation={operation} /> },
  ]);

  inFrench(<RouterProvider router={router} />, access);
}

describe("mercury status of a grinding", () => {
  it("marks the mercury as added once the user confirms it", async () => {
    const user = userEvent.setup();
    showMercury(running);

    await user.click(screen.getByRole("button", { name: mercury.pending }));
    expect(screen.getByText(mercury.confirm)).toBeVisible();
    expect(api.markMercuryAdded).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: mercury.confirmYes }));

    expect(api.markMercuryAdded).toHaveBeenCalledWith("42");
    await waitFor(() => {
      expect(screen.queryByText(mercury.confirm)).toBeNull();
    });
  });

  it("leaves it as it was when the user cancels", async () => {
    const user = userEvent.setup();
    showMercury(running);

    await user.click(screen.getByRole("button", { name: mercury.pending }));
    await user.click(screen.getByRole("button", { name: messages.common.cancel }));

    expect(screen.getByRole("button", { name: mercury.pending })).toBeVisible();
    expect(api.markMercuryAdded).not.toHaveBeenCalled();
  });

  it("shows why the backend refused it", async () => {
    api.markMercuryAdded.mockResolvedValue({
      ok: false,
      fieldErrors: { mercury: "Le broyage est terminé." },
      failed: false,
    });
    const user = userEvent.setup();
    showMercury(running);

    await user.click(screen.getByRole("button", { name: mercury.pending }));
    await user.click(screen.getByRole("button", { name: mercury.confirmYes }));

    expect(await screen.findByText("Le broyage est terminé.")).toBeVisible();
  });

  it("shows an added mercury with no way to take it back", () => {
    showMercury({ ...running, mercury: { addedAt: "2026-10-08T07:00:00.000Z", byName: "Aicha" } });

    expect(screen.getByText(mercury.added)).toBeVisible();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows a view-only role the status without a button", () => {
    showMercury(running, {
      superuser: false,
      rights: rightsFromApi([{ module: "grinding", can_view: true }]),
    });

    expect(screen.getByText(mercury.pending)).toBeVisible();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
