import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/fr.json";
import type { MillingOperation } from "@/lib/grinding";
import { EndMillingAction } from "./MillingForms";

const api = vi.hoisted(() => ({ endOperation: vi.fn() }));

vi.mock("./millingApi", () => api);

const end = messages.milling.end;

beforeEach(() => {
  api.endOperation.mockReset();
  api.endOperation.mockResolvedValue({ ok: true });
});

function inFrench(children: React.ReactNode) {
  return render(
    <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
      {children}
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

async function openEndMilling() {
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

  inFrench(<RouterProvider router={router} />);
  await user.click(screen.getByRole("button", { name: "Terminer" }));
  await user.type(screen.getByLabelText(end.bagsMilled), "2");

  return { user, router };
}

describe("ending a milling operation", () => {
  it("shows the cost for the bags milled, read-only", async () => {
    const { user } = await openEndMilling();

    expect(screen.getByText("2 sacs × 1 500,0 MRU")).toBeVisible();

    const bags = screen.getByLabelText(end.bagsMilled);
    await user.clear(bags);
    await user.type(bags, "1");

    expect(screen.getByText("1 500,0 MRU")).toBeVisible();
  });

  it("rejects an end before the start", async () => {
    const { user } = await openEndMilling();

    const time = screen.getByLabelText(end.endTime);
    await user.clear(time);
    await user.type(time, "0500");
    await user.click(screen.getByRole("button", { name: end.submit }));

    expect(await screen.findByText(end.errors.endBeforeStart)).toBeVisible();
    expect(api.endOperation).not.toHaveBeenCalled();
  });

  it("rejects more bags than allocated", async () => {
    const { user } = await openEndMilling();

    const bags = screen.getByLabelText(end.bagsMilled);
    await user.clear(bags);
    await user.type(bags, "3");
    await user.click(screen.getByRole("button", { name: end.submit }));

    expect(await screen.findByText(end.errors.bagsMilledInvalid)).toBeVisible();
    expect(api.endOperation).not.toHaveBeenCalled();
  });

  it("ends the operation with the shipment's next status and opens its refining", async () => {
    const { user, router } = await openEndMilling();

    await user.click(screen.getByRole("button", { name: end.submit }));

    await waitFor(() => {
      expect(api.endOperation).toHaveBeenCalledWith(
        running,
        "52",
        { endDate: "2026-10-08", endTime: "12:30", bagsMilled: 2, notes: "" },
        "2026-10-08T12:30:00.000Z",
        "completed",
      );
    });
    expect(await screen.findByRole("heading", { name: "refining page" })).toBeVisible();
    expect(`${router.state.location.pathname}${router.state.location.search}`).toBe(
      "/fr/refining?grinding=42",
    );
  });
});
