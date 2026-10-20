import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { noAccess } from "@/lib/access";
import type { Access } from "@/lib/access";
import { AccessContext } from "@/lib/accessContext";
import messages from "@/messages/fr.json";
import { ToastProvider } from "@/components/ui/Toast";
import { ShipmentScreen, shipmentLoader } from "./ShipmentScreen";

const API = `${window.location.origin}/api/v1`;
const server = setupServer();
const allRights: Access = { ...noAccess, superuser: true };
const viewer: Access = {
  ...noAccess,
  rights: {
    ...noAccess.rights,
    shipments: { view: true, add: false, edit: false, delete: false },
  },
};
const detail = messages.shipments.detail;
const paymentForm = messages.shipments.paymentForm;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const stamps = { created_at: "2026-10-10T08:30:00Z", updated_at: "2026-10-12T10:00:00Z" };

const page = (results: readonly object[]) => HttpResponse.json({ count: results.length, results });

function apiShipment(
  payments: readonly { id: number; amount: string; paid_at: string }[],
  debt = "350.00",
) {
  const paid = payments.reduce((total, payment) => total + Number(payment.amount), 0);

  return {
    id: 52,
    number: "SHP-00052",
    invoice_number: null,
    invoiced_at: null,
    customer_name: "Sidi",
    customer_phone: "+222 46 10 93 25",
    arrival_date: "2026-10-10T08:30:00Z",
    bags_count: 10,
    bag_transport_cost_per_bag: "300.00",
    passengers_count: 1,
    passenger_transport_cost_per_person: "200.00",
    current_payment: String(paid),
    debt,
    debt_notes: "Avance sur le prochain voyage",
    payments: payments.map((payment) => ({ ...payment, notes: "" })),
    transport_method: "truck",
    source: "Chami",
    project: 3,
    status: "pending",
    notes: "",
    created_by_name: "med",
    ...stamps,
  };
}

function answer(
  payments: readonly { id: number; amount: string; paid_at: string }[],
  debt = "350.00",
) {
  server.use(
    http.get(`${API}/shipments/52/`, () => HttpResponse.json(apiShipment(payments, debt))),
    http.get(`${API}/customers/`, () =>
      page([{ id: 7, full_name: "Sidi", phone: "+222 46 10 93 25", is_active: true, ...stamps }]),
    ),
    http.get(`${API}/projects/`, () =>
      page([{ id: 3, name: "Zouérat 1", site: "zouerat", status: "active", ...stamps }]),
    ),
  );
}

const firstPayment = { id: 1, amount: "1000.00", paid_at: "2026-10-10T08:30:00Z" };

function openShipment(access: Access = allRights) {
  const router = createMemoryRouter(
    [
      { path: "/fr/shipments/:shipment", loader: shipmentLoader, element: <ShipmentScreen /> },
      { path: "/fr/shipments/projects/:project", element: <h1>project shipments</h1> },
    ],
    { initialEntries: ["/fr/shipments/52"] },
  );

  render(
    <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
      <AccessContext value={access}>
        <ToastProvider anchor={{ current: null }}>
          <RouterProvider router={router} />
        </ToastProvider>
      </AccessContext>
    </IntlProvider>,
  );

  return router;
}

describe("ShipmentScreen", () => {
  it("shows what was paid, in which payments, and what is left", async () => {
    answer([firstPayment]);
    openShipment();

    expect(
      await screen.findByRole("heading", { name: detail.title.replace("{number}", "SHP-00052") }),
    ).toBeVisible();
    expect(screen.getByText(detail.shipmentStatus).nextElementSibling).toHaveTextContent(
      messages.shipments.statuses.pending,
    );
    expect(screen.getByText(detail.paymentStatus).nextElementSibling).toHaveTextContent(
      messages.shipments.payment.incomplete,
    );
    const debt = screen.getAllByText(detail.debtLabel)[0]?.nextElementSibling;
    expect(debt).toHaveTextContent(messages.shipments.debt.badge);
    expect(debt).toHaveTextContent("Avance sur le prochain voyage");
    const payments = within(screen.getByRole("table"));
    const [, row] = payments.getAllByRole("row");
    expect(row).toHaveTextContent(detail.installment.replace("{n}", "1"));
    expect(row).toHaveTextContent(/1\s000/);
    expect(screen.getAllByText(detail.left)[0]?.nextElementSibling).toHaveTextContent(/2\s200/);
    expect(screen.getByText(messages.shipments.payment.incomplete)).toBeVisible();
  });

  it("increases the debt by the amount typed, with its reason", async () => {
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

    await user.click(await screen.findByRole("button", { name: detail.addDebt }));
    const drawer = within(screen.getByRole("dialog", { name: messages.shipments.debtForm.title }));
    expect(drawer.getByLabelText(messages.shipments.debtForm.notes)).toHaveValue(
      "Avance sur le prochain voyage",
    );
    await user.type(drawer.getByLabelText(messages.shipments.debtForm.amount), "150");
    expect(
      drawer.getByText(messages.shipments.debtForm.after).nextElementSibling,
    ).toHaveTextContent("500");
    await user.click(drawer.getByRole("button", { name: messages.shipments.debtForm.submit }));

    await waitFor(() => {
      expect(sent).toEqual({ debt: "500", debt_notes: "Avance sur le prochain voyage" });
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
    expect(screen.queryByText(detail.debtLabel)).toBeNull();
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
      expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(3);
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

  it("offers no new payment once the shipment is fully paid", async () => {
    answer([firstPayment, { id: 2, amount: "2200.00", paid_at: "2026-10-12T10:00:00Z" }]);
    openShipment();

    expect(await screen.findByText(messages.shipments.payment.complete)).toBeVisible();
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
    expect(sent).toMatchObject({ customer: 7, bags_count: 12, project: 3, debt: "350" });
    expect(sent).not.toHaveProperty("current_payment");
  });

  it("shows the shipment without a form to a role that cannot edit it", async () => {
    answer([firstPayment]);
    openShipment(viewer);

    expect(await screen.findByText(detail.detailsTitle)).toBeVisible();
    expect(screen.queryByLabelText(messages.shipments.form.bagCount)).toBeNull();
    expect(screen.queryByRole("button", { name: detail.addPayment })).toBeNull();
  });
});
