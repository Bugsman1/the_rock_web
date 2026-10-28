import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rightsFromApi } from "@/lib/access";
import type { Access } from "@/lib/access";
import type { MillingOperation } from "@/lib/grinding";
import messages from "@/messages/fr.json";
import { EndMillingAction } from "./MillingForms";
import { allRights, inFrench, running } from "./millingTesting";

const api = vi.hoisted(() => ({ endOperation: vi.fn() }));

vi.mock("./millingApi", () => api);

const end = messages.milling.end;

const mercured: MillingOperation = {
  ...running,
  mercury: {
    addedAt: "2026-10-08T07:00:00.000Z",
    byName: "Aicha",
    quantity: 120,
    total: 120,
    additions: [],
  },
};

const machineLoader = vi.fn(() => null);

beforeEach(() => {
  api.endOperation.mockReset();
  api.endOperation.mockResolvedValue({ ok: true });
  machineLoader.mockClear();
});

function renderEndMilling(access: Access, defaultTime: string, operation: MillingOperation) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        loader: machineLoader,
        element: (
          <EndMillingAction
            label="Terminer"
            title={end.title}
            closeLabel={messages.common.close}
            operation={operation}
            defaultDate="2026-10-08"
            defaultTime={defaultTime}
          />
        ),
      },
      { path: "/fr/refining/projects/:project", element: <h1>refining page</h1> },
    ],
    { initialEntries: ["/"] },
  );

  inFrench(<RouterProvider router={router} />, access);

  return router;
}

async function openEndMilling(access: Access = allRights, defaultTime = "12:30") {
  const router = renderEndMilling(access, defaultTime, mercured);
  const user = userEvent.setup();

  await user.click(await screen.findByRole("button", { name: "Terminer" }));

  return { user, router };
}

describe("ending a milling operation", () => {
  it("shows the end time it records, with no way to change it", async () => {
    await openEndMilling();

    expect(screen.queryByLabelText(end.endTime)).not.toBeInTheDocument();
    expect(screen.getByText(end.endTime).nextSibling).toHaveTextContent("12:30");
  });

  it("refuses an end before the start, such as a wrong clock", async () => {
    const { user } = await openEndMilling(allRights, "05:00");

    await user.click(screen.getByRole("button", { name: end.submit }));

    expect(await screen.findByText(end.errors.endBeforeStart)).toBeVisible();
    expect(api.endOperation).not.toHaveBeenCalled();
  });

  it("ends the operation with the shipment's next status and opens its refining", async () => {
    const { user, router } = await openEndMilling();

    await user.click(screen.getByRole("button", { name: end.submit }));

    await waitFor(() => {
      expect(api.endOperation).toHaveBeenCalledWith(
        mercured,
        { endDate: "2026-10-08", endTime: "12:30", notes: "" },
        "2026-10-08T12:30:00.000Z",
      );
    });
    expect(await screen.findByRole("heading", { name: "refining page" })).toBeVisible();
    expect(`${router.state.location.pathname}${router.state.location.search}`).toBe(
      "/fr/refining/projects/3?grinding=42",
    );
  });

  it("cannot be finished before mercury is added", async () => {
    renderEndMilling(allRights, "12:30", running);
    const user = userEvent.setup();
    const finish = await screen.findByRole("button", { name: "Terminer" });

    expect(finish).toBeDisabled();
    await user.click(finish);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.endOperation).not.toHaveBeenCalled();
  });

  it("stays on the machine when the role may not start the refining", async () => {
    const { user, router } = await openEndMilling({
      userId: "",
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
