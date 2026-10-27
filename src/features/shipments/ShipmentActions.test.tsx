import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import messages from "@/messages/fr.json";
import {
  apiShipment,
  cancelledByMed,
  firstPayment,
  openShipment,
  SHIPMENT_API,
  shipmentHandlers,
  viewer,
} from "./shipmentFormTesting";

const API = SHIPMENT_API;
const server = setupServer();
const detail = messages.shipments.detail;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function answer(...args: Parameters<typeof shipmentHandlers>) {
  server.use(...shipmentHandlers(...args));
}

describe("cancel", () => {
  const cancel = messages.shipments.cancel;

  function cancelButton() {
    return screen.findByRole("button", { name: cancel.button });
  }

  it("cancels the shipment with its reason once confirmed, then shows it cancelled", async () => {
    answer([firstPayment]);
    let sent: unknown;
    server.use(
      http.post(`${API}/shipments/52/cancel/`, async ({ request }) => {
        sent = await request.json();
        answer([firstPayment], "350.00", cancelledByMed);
        return HttpResponse.json(apiShipment([firstPayment], "350.00", cancelledByMed));
      }),
    );
    const user = userEvent.setup();
    openShipment();

    await user.click(await cancelButton());
    const dialog = within(
      screen.getByRole("dialog", { name: cancel.title.replace("{number}", "SHP-00052") }),
    );
    expect(sent).toBeUndefined();
    await user.type(dialog.getByLabelText(cancel.reason), " Client parti ");
    await user.click(dialog.getByRole("button", { name: cancel.confirm }));

    expect(await screen.findByText("Client parti")).toBeVisible();
    expect(sent).toEqual({ reason: "Client parti" });
    expect(screen.getByText(messages.shipments.statuses.cancelled)).toBeVisible();
    expect(screen.getByText(detail.cancelledAt)).toBeVisible();
    expect(screen.queryByRole("button", { name: cancel.button })).toBeNull();
    expect(screen.getByRole("status", { hidden: true })).toHaveTextContent(
      messages.toasts.shipmentCancelled,
    );
  });

  it("sends nothing when the user steps back", async () => {
    answer([firstPayment]);
    let sent = false;
    server.use(
      http.post(`${API}/shipments/52/cancel/`, () => {
        sent = true;
        return HttpResponse.json({});
      }),
    );
    const user = userEvent.setup();
    openShipment();

    await user.click(await cancelButton());
    await user.click(screen.getByRole("button", { name: cancel.keep }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(sent).toBe(false);
  });

  it("shows the backend's refusal in the popup", async () => {
    answer([firstPayment]);
    server.use(
      http.post(`${API}/shipments/52/cancel/`, () =>
        HttpResponse.json({ status: ["Déjà terminée."] }, { status: 400 }),
      ),
    );
    const user = userEvent.setup();
    openShipment();

    await user.click(await cancelButton());
    const dialog = within(screen.getByRole("dialog"));
    await user.click(dialog.getByRole("button", { name: cancel.confirm }));

    expect(await dialog.findByText("Déjà terminée.")).toBeVisible();
  });

  it("is offered only to a role that can edit, on a shipment still in progress", async () => {
    answer([firstPayment]);
    openShipment(viewer);
    expect(await screen.findByText(detail.detailsTitle)).toBeVisible();
    expect(screen.queryByRole("button", { name: cancel.button })).toBeNull();
  });

  it("is not offered on a completed shipment", async () => {
    answer([firstPayment], "350.00", { status: "completed" });
    openShipment();
    expect(await screen.findByText(detail.detailsTitle)).toBeVisible();
    expect(screen.queryByRole("button", { name: cancel.button })).toBeNull();
  });
});
describe("test bags", () => {
  const testBags = messages.shipments.testBags;

  function fact(label: string) {
    return screen.getByText(label, { selector: "dt" }).nextElementSibling?.textContent;
  }

  async function openTestBags() {
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: testBags.button }));
    return { user, dialog: within(screen.getByRole("dialog")) };
  }

  it("shows the current bags, the test bags and their total", async () => {
    answer([firstPayment], "350.00", { bags_count: 8.5, test_bags_count: 1.5 });
    openShipment();

    expect(await screen.findByText(detail.currentBags)).toBeVisible();
    expect([fact(detail.currentBags), fact(detail.testBags), fact(detail.totalBags)]).toEqual([
      "8,5",
      "1,5",
      "10",
    ]);
  });

  it("moves the test bags out of the current bags, keeping the total", async () => {
    answer([firstPayment]);
    let sent: unknown;
    server.use(
      http.patch(`${API}/shipments/52/`, async ({ request }) => {
        sent = await request.json();
        answer([firstPayment], "350.00", { bags_count: 8.5, test_bags_count: 1.5 });
        return HttpResponse.json({});
      }),
    );
    openShipment();
    const { user, dialog } = await openTestBags();

    await user.type(dialog.getByLabelText(testBags.field), "1.5");
    expect(dialog.getByText("8,5")).toBeVisible();
    await user.click(dialog.getByRole("button", { name: testBags.submit }));

    await waitFor(() => expect(fact(detail.testBags)).toBe("1,5"));
    expect(sent).toEqual({ bags_count: 8.5, test_bags_count: 1.5 });
    expect(fact(detail.currentBags)).toBe("8,5");
    expect(screen.getByRole("status", { hidden: true })).toHaveTextContent(
      messages.toasts.testBagsSaved,
    );
  });

  it("clears the test bags with 0, putting them back into the current bags", async () => {
    answer([firstPayment], "350.00", { bags_count: 8.5, test_bags_count: 1.5 });
    let sent: unknown;
    server.use(
      http.patch(`${API}/shipments/52/`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({});
      }),
    );
    openShipment();
    const { user, dialog } = await openTestBags();

    const field = dialog.getByLabelText(testBags.field);
    expect(field).toHaveValue(1.5);
    await user.clear(field);
    await user.type(field, "0");
    await user.click(dialog.getByRole("button", { name: testBags.submit }));

    await waitFor(() => expect(sent).toEqual({ bags_count: 10, test_bags_count: 0 }));
  });

  it("refuses as many test bags as the shipment has, and sends nothing", async () => {
    answer([firstPayment]);
    let sent = false;
    server.use(
      http.patch(`${API}/shipments/52/`, () => {
        sent = true;
        return HttpResponse.json({});
      }),
    );
    openShipment();
    const { user, dialog } = await openTestBags();

    await user.type(dialog.getByLabelText(testBags.field), "10");
    await user.click(dialog.getByRole("button", { name: testBags.submit }));

    expect(await dialog.findByText(testBags.tooMany.replace("{total}", "10"))).toBeVisible();
    expect(sent).toBe(false);
  });

  it("shows the backend's refusal on the test bags", async () => {
    answer([firstPayment]);
    server.use(
      http.patch(`${API}/shipments/52/`, () =>
        HttpResponse.json(
          { bags_count: ["4 sacs de cette expédition sont déjà en broyage."] },
          { status: 400 },
        ),
      ),
    );
    openShipment();
    const { user, dialog } = await openTestBags();

    await user.type(dialog.getByLabelText(testBags.field), "7");
    await user.click(dialog.getByRole("button", { name: testBags.submit }));

    expect(
      await dialog.findByText("4 sacs de cette expédition sont déjà en broyage."),
    ).toBeVisible();
  });
});
