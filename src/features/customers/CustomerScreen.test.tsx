import { render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { noAccess } from "@/lib/access";
import { AccessContext } from "@/lib/accessContext";
import messages from "@/messages/fr.json";
import { CustomerScreen, customerLoader } from "./CustomerScreen";

const API = `${window.location.origin}/api/v1`;
const server = setupServer();
const detail = messages.customers.detail;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const stamps = { created_at: "2026-09-01T08:00:00Z", updated_at: "2026-09-01T08:00:00Z" };

function apiShipment(id: number, status: string, paid: string) {
  return {
    id,
    number: `SHP-0000${id}`,
    invoice_number: null,
    invoiced_at: null,
    customer_name: "Ahmed",
    customer_phone: "+222 22 41 18 30",
    arrival_date: `2026-10-0${id}T08:00:00Z`,
    bags_count: 10.5,
    bag_transport_cost_per_bag: "100.00",
    passengers_count: 0,
    passenger_transport_cost_per_person: "0.00",
    current_payment: paid,
    debt: id === 1 ? "250.00" : "0.00",
    payments: [],
    transport_method: "truck",
    source: "Chami",
    project: 3,
    status,
    notes: "",
    created_by_name: "med",
    ...stamps,
  };
}

function answer(shipments: readonly object[], seen: URL[] = []) {
  server.use(
    http.get(`${API}/customers/7/`, () =>
      HttpResponse.json({
        id: 7,
        full_name: "Ahmed",
        phone: "+222 22 41 18 30",
        is_active: true,
        ...stamps,
      }),
    ),
    http.get(`${API}/shipments/`, ({ request }) => {
      seen.push(new URL(request.url));
      return HttpResponse.json({ count: shipments.length, results: shipments });
    }),
    http.get(`${API}/projects/`, () =>
      HttpResponse.json({
        count: 1,
        results: [{ id: 3, name: "Zouérat 1", site: "zouerat", status: "active", ...stamps }],
      }),
    ),
  );

  return seen;
}

function openCustomer() {
  const router = createMemoryRouter(
    [{ path: "/fr/customers/:customer", loader: customerLoader, element: <CustomerScreen /> }],
    { initialEntries: ["/fr/customers/7"] },
  );

  render(
    <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
      <AccessContext value={{ ...noAccess, superuser: true }}>
        <RouterProvider router={router} />
      </AccessContext>
    </IntlProvider>,
  );
}

describe("CustomerScreen", () => {
  it("lists every shipment received from the client, each opening its page", async () => {
    const seen = answer([
      apiShipment(2, "pending", "0.00"),
      apiShipment(1, "completed", "1050.00"),
    ]);
    openCustomer();

    expect(await screen.findByRole("heading", { name: "Ahmed" })).toBeVisible();
    expect(seen[0]?.searchParams.get("customer")).toBe("7");

    const [, latest, first] = within(screen.getByRole("table")).getAllByRole("row");
    expect(latest).toHaveTextContent("SHP-00002");
    expect(latest).toHaveTextContent("Zouérat 1");
    expect(latest).toHaveTextContent("10,5");
    expect(latest).toHaveTextContent(messages.shipments.statuses.pending);
    expect(latest).toHaveTextContent(messages.shipments.payment.incomplete);
    expect(first).toHaveTextContent(messages.shipments.payment.complete);
    expect(screen.getByRole("link", { name: "SHP-00002" })).toHaveAttribute(
      "href",
      "/fr/shipments/2",
    );
  });

  it("keeps the phone's digits in order whatever the page direction", async () => {
    answer([]);
    openCustomer();

    expect(await screen.findByRole("heading", { name: "Ahmed" })).toBeVisible();
    expect(screen.getByText("+222 22 41 18 30")).toHaveAttribute("dir", "ltr");
  });

  it("sums the shipments, their bags and what is left to pay", async () => {
    answer([apiShipment(2, "pending", "0.00"), apiShipment(1, "completed", "1050.00")]);
    openCustomer();

    expect(await screen.findByText(detail.shipments)).toBeVisible();
    expect(screen.getByText(detail.shipments).nextElementSibling).toHaveTextContent("2");
    expect(screen.getByText(detail.bags).nextElementSibling).toHaveTextContent("21");
    expect(screen.getByRole("note")).toHaveTextContent(detail.debt);
    expect(screen.getByRole("note")).toHaveTextContent("250");
    const [, , totals] = within(screen.getByRole("table")).getAllByRole("rowgroup");
    expect(totals).toHaveTextContent(`${messages.common.total}21`);
    expect(screen.getByText(detail.leftToPay).nextElementSibling).toHaveTextContent(/1\s050/);
  });

  it("says when nothing was received from the client yet", async () => {
    answer([]);
    openCustomer();

    expect(await screen.findByText(detail.noShipments)).toBeVisible();
  });
});
