import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rightsFromApi } from "@/lib/access";
import type { Access } from "@/lib/access";
import type { MillingOperation } from "@/lib/grinding";
import messages from "@/messages/fr.json";
import { MercuryStatus } from "./MercuryForm";
import { allRights, inFrench, running } from "./millingTesting";

const api = vi.hoisted(() => ({ markMercuryAdded: vi.fn() }));

vi.mock("./millingApi", () => api);

const mercury = messages.milling.mercury;

beforeEach(() => {
  api.markMercuryAdded.mockReset();
  api.markMercuryAdded.mockResolvedValue({ ok: true });
});

function showMercury(operation: MillingOperation, access: Access = allRights) {
  const router = createMemoryRouter([
    { path: "/", element: <MercuryStatus operation={operation} /> },
  ]);

  inFrench(<RouterProvider router={router} />, access);
}

async function openMercuryForm() {
  const user = userEvent.setup();
  showMercury(running);
  await user.click(screen.getByRole("button", { name: mercury.pending }));

  return user;
}

describe("mercury added to a grinding", () => {
  it("asks how many grams were added and sends them to be taken from the stock", async () => {
    const user = await openMercuryForm();

    expect(screen.getByRole("dialog", { name: mercury.title })).toBeVisible();
    await user.type(screen.getByLabelText(mercury.quantity), "150.5");
    await user.click(screen.getByRole("button", { name: mercury.submit }));

    await waitFor(() => {
      expect(api.markMercuryAdded).toHaveBeenCalledWith("42", { quantity: 150.5 });
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("refuses an empty quantity or one under 100 grams", async () => {
    const user = await openMercuryForm();

    await user.click(screen.getByRole("button", { name: mercury.submit }));
    expect(await screen.findByText(messages.common.validation.required)).toBeVisible();

    await user.type(screen.getByLabelText(mercury.quantity), "99");
    await user.click(screen.getByRole("button", { name: mercury.submit }));
    expect(await screen.findByText(mercury.quantityTooLow.replace("{min}", "100"))).toBeVisible();
    expect(api.markMercuryAdded).not.toHaveBeenCalled();
  });

  it("leaves it as it was when the user cancels", async () => {
    const user = await openMercuryForm();

    await user.click(screen.getByRole("button", { name: messages.common.cancel }));

    expect(screen.getByRole("button", { name: mercury.pending })).toBeVisible();
    expect(api.markMercuryAdded).not.toHaveBeenCalled();
  });

  it("says in the reader's language when the project's mercury stock is too low", async () => {
    api.markMercuryAdded.mockResolvedValue({
      ok: false,
      fieldErrors: { quantity: "This project has no mercury in stock." },
      failed: false,
    });
    const user = await openMercuryForm();

    await user.type(screen.getByLabelText(mercury.quantity), "500");
    await user.click(screen.getByRole("button", { name: mercury.submit }));

    expect(await screen.findByText(mercury.notEnoughStock)).toBeVisible();
    expect(screen.queryByText("This project has no mercury in stock.")).not.toBeInTheDocument();
  });

  it("says when the grinding can no longer take mercury", async () => {
    api.markMercuryAdded.mockResolvedValue({
      ok: false,
      fieldErrors: { closed: "The grinding is finished; mercury can no longer be added." },
      failed: false,
    });
    const user = await openMercuryForm();

    await user.type(screen.getByLabelText(mercury.quantity), "150");
    await user.click(screen.getByRole("button", { name: mercury.submit }));

    expect(await screen.findByText(mercury.cannotAdd)).toBeVisible();
  });

  it("shows an added mercury with no way to take it back", () => {
    showMercury({
      ...running,
      mercury: { addedAt: "2026-10-08T07:00:00.000Z", byName: "Aicha", quantity: 12.5 },
    });

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
