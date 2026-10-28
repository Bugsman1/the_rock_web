import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/format";
import messages from "@/messages/fr.json";
import {
  firstPayment,
  openShipment,
  SHIPMENT_API,
  shipmentHandlers,
  viewer,
} from "./shipmentFormTesting";

const API = SHIPMENT_API;
const server = setupServer();
const detail = messages.shipments.detail;
const paymentForm = messages.shipments.paymentForm;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function answer(...args: Parameters<typeof shipmentHandlers>) {
  server.use(...shipmentHandlers(...args));
}

function panel(title: string) {
  const section = screen.getByText(title, { selector: "h2" }).closest("section");

  if (section === null) {
    throw new Error(`no panel ${title}`);
  }

  return within(section);
}

describe("ShipmentScreen", () => {
  it("shows what was paid, in which payments, and what is left", async () => {
    answer([firstPayment]);
    openShipment();

    expect(
      await screen.findByRole("heading", { name: detail.title.replace("{number}", "SHP-00052") }),
    ).toBeVisible();
    expect(screen.queryByText(messages.shipments.statuses.pending)).not.toBeInTheDocument();
    expect(screen.queryByText(messages.shipments.payment.incomplete)).not.toBeInTheDocument();
    const payments = panel(detail.paymentsTitle);
    const [, row] = payments.getAllByRole("row");
    expect(row).toHaveTextContent(detail.installment.replace("{n}", "1"));
    expect(row).toHaveTextContent(/1\s000/);
    expect(screen.getAllByText(detail.left)[0]?.nextElementSibling).toHaveTextContent(/2\s200/);
  });

  it("adds a new debt of its own, with its reason", async () => {
    answer([firstPayment]);
    let sent: unknown;
    server.use(
      http.post(`${API}/shipment-debts/`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    openShipment();

    await user.click(await screen.findByRole("button", { name: detail.addDebt }));
    const drawer = within(screen.getByRole("dialog", { name: messages.shipments.debtForm.title }));
    expect(drawer.getByLabelText(messages.shipments.debtForm.notes)).toHaveValue("");
    await user.type(drawer.getByLabelText(messages.shipments.debtForm.amount), "150");
    expect(
      drawer.getByText(messages.shipments.debtForm.after).nextElementSibling,
    ).toHaveTextContent("500");
    await user.type(drawer.getByLabelText(messages.shipments.debtForm.notes), "Carburant");
    await user.click(drawer.getByRole("button", { name: messages.shipments.debtForm.submit }));

    await waitFor(() => {
      expect(sent).toEqual({ shipment: 52, amount: "150", description: "Carburant" });
    });
  });

  it("offers to add a debt to a shipment without one, with no debt field in its form", async () => {
    answer([firstPayment], "0.00");
    openShipment();

    expect(
      await screen.findByRole("button", { name: messages.shipments.debtForm.add }),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: detail.addDebt })).toBeNull();
    expect(screen.queryByLabelText(messages.shipments.form.debt)).toBeNull();
    expect(screen.getByText(detail.noDebt)).toBeVisible();
  });

  it("lists every debt with its date, amount and reason, and their total", async () => {
    answer([firstPayment]);
    openShipment();

    await screen.findByText(detail.debtLabel, { selector: "h2" });
    const debt = panel(detail.debtLabel);
    const [header, first, second, total] = debt.getAllByRole("row");

    expect(header).toHaveTextContent(detail.columns.incurredAt);
    expect(header).toHaveTextContent(detail.columns.amount);
    expect(header).toHaveTextContent(messages.shipments.debtForm.notes);
    expect(first).toHaveTextContent(formatMoney(200, "fr"));
    expect(first).toHaveTextContent("Avance sur le prochain voyage");
    expect(second).toHaveTextContent(formatMoney(150, "fr"));
    expect(second).toHaveTextContent("—");
    expect(total).toHaveTextContent(`${messages.common.total}${formatMoney(350, "fr")}`);
    expect(debt.getByRole("button", { name: detail.addDebt })).toBeVisible();
  });

  it("adds a second payment and shows it", async () => {
    answer([firstPayment]);
    let sent: unknown;
    server.use(
      http.post(`${API}/shipment-payments/`, async ({ request }) => {
        sent = await request.json();
        answer([firstPayment, { id: 2, amount: "1200.00", paid_at: "2026-10-12T10:00:00Z" }]);
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    openShipment();

    await user.click(await screen.findByRole("button", { name: detail.addPayment }));
    const drawer = within(screen.getByRole("dialog", { name: paymentForm.title }));
    await user.type(drawer.getByLabelText(paymentForm.amount), "1200");
    await user.click(drawer.getByRole("button", { name: paymentForm.submit }));

    await waitFor(() => {
      expect(panel(detail.paymentsTitle).getAllByRole("row")).toHaveLength(4);
    });
    expect(sent).toMatchObject({ shipment: 52, amount: "1200" });
  });

  it("shows what is left now and after the typed payment", async () => {
    answer([firstPayment]);
    const user = userEvent.setup();
    openShipment();

    await user.click(await screen.findByRole("button", { name: detail.addPayment }));
    const drawer = within(screen.getByRole("dialog", { name: paymentForm.title }));
    expect(drawer.getByText(paymentForm.leftNow).nextElementSibling).toHaveTextContent(/2\s200/);
    expect(drawer.getByText(paymentForm.leftAfter).nextElementSibling).toHaveTextContent("—");

    await user.type(drawer.getByLabelText(paymentForm.amount), "1200");

    expect(drawer.getByText(paymentForm.leftAfter).nextElementSibling).toHaveTextContent(/1\s000/);
  });

  it("refuses a payment above what is left to pay as soon as it is typed", async () => {
    answer([firstPayment]);
    const user = userEvent.setup();
    openShipment();

    await user.click(await screen.findByRole("button", { name: detail.addPayment }));
    const drawer = within(screen.getByRole("dialog", { name: paymentForm.title }));
    await user.type(drawer.getByLabelText(paymentForm.amount), "2500");

    expect(
      await drawer.findByText(/Le montant ne peut pas dépasser le reste à payer/),
    ).toBeVisible();
  });

  it("asks before throwing away a typed payment, and sends nothing", async () => {
    answer([firstPayment]);
    let sent = false;
    server.use(
      http.post(`${API}/shipment-payments/`, () => {
        sent = true;
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    openShipment();

    await user.click(await screen.findByRole("button", { name: detail.addPayment }));
    const drawer = within(screen.getByRole("dialog", { name: paymentForm.title }));
    await user.type(drawer.getByLabelText(paymentForm.amount), "500");
    await user.click(drawer.getByRole("button", { name: messages.common.cancel }));

    expect(drawer.getByText(messages.common.discard.question)).toBeVisible();

    await user.click(drawer.getByRole("button", { name: messages.common.discard.confirm }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: paymentForm.title })).not.toBeInTheDocument();
    });
    expect(sent).toBe(false);
  });

  it("offers no new payment once the shipment is fully paid", async () => {
    answer([firstPayment, { id: 2, amount: "2200.00", paid_at: "2026-10-12T10:00:00Z" }]);
    openShipment();

    expect(await screen.findByText(detail.installment.replace("{n}", "2"))).toBeVisible();
    expect(screen.queryByRole("button", { name: detail.addPayment })).toBeNull();
  });

  it("saves the edited shipment without touching its payments, then goes back to the list", async () => {
    answer([firstPayment]);
    let sent: unknown;
    server.use(
      http.patch(`${API}/shipments/52/`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({});
      }),
    );
    const user = userEvent.setup();
    openShipment();

    const bags = await screen.findByLabelText(messages.shipments.form.bagCount);
    expect(bags).toHaveValue(10);
    await user.clear(bags);
    await user.type(bags, "12");
    await user.click(screen.getByRole("button", { name: messages.shipments.form.saveChanges }));

    expect(await screen.findByRole("heading", { name: "project shipments" })).toBeVisible();
    expect(screen.getByRole("status", { hidden: true })).toHaveTextContent(
      messages.toasts.shipmentUpdated,
    );
    expect(sent).toMatchObject({ customer: 7, bags_count: 12, project: 3 });
    expect(sent).not.toHaveProperty("debt");
    expect(sent).not.toHaveProperty("current_payment");
  });

  it("clears the unloading cost when it is emptied", async () => {
    answer([firstPayment], "350.00", {
      unloading_cost_per_bag: "40.00",
      unloading_total: "440.00",
    });
    let sent: unknown;
    server.use(
      http.patch(`${API}/shipments/52/`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({});
      }),
    );
    const user = userEvent.setup();
    openShipment();

    const unloading = await screen.findByLabelText(messages.shipments.form.unloadingFare);
    expect(unloading).toHaveValue(40);
    await user.clear(unloading);
    await user.click(screen.getByRole("button", { name: messages.shipments.form.saveChanges }));

    await screen.findByRole("heading", { name: "project shipments" });
    expect(sent).toMatchObject({ unloading_cost_per_bag: null });
  });

  it("shows the unloading to a role that cannot edit the shipment", async () => {
    answer([firstPayment], "350.00", {
      unloading_cost_per_bag: "40.00",
      unloading_total: "440.00",
    });
    openShipment(viewer);

    const unloadingTotal = await screen.findByText(messages.shipments.form.unloadingTotal);
    expect(unloadingTotal.nextElementSibling).toHaveTextContent(formatMoney(440, "fr"));
    expect(
      screen.getByText(messages.shipments.form.unloadingFare).nextElementSibling,
    ).toHaveTextContent(formatMoney(40, "fr"));
  });

  it("shows the shipment without a form to a role that cannot edit it", async () => {
    answer([firstPayment]);
    openShipment(viewer);

    expect(await screen.findByText(detail.detailsTitle)).toBeVisible();
    expect(screen.queryByLabelText(messages.shipments.form.bagCount)).toBeNull();
    expect(screen.queryByRole("button", { name: detail.addPayment })).toBeNull();
  });
});
