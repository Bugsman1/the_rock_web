import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { listQueryFromParams } from "@/lib/filters";
import messages from "@/messages/fr.json";
import type { ShipmentRecord } from "@/lib/shipments";
import { historyStatuses, shipmentGroupChoices } from "./shipmentHistory";
import { ShipmentHistory } from "./ShipmentHistoryScreen";

const history = messages.shipments.history;
const filters = messages.filters;
const HISTORY_PATH = "/fr/shipments/projects/3/history";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function record(shipmentNumber: string, customerName: string, arrivedAt: string): ShipmentRecord {
  return {
    id: shipmentNumber,
    shipmentNumber,
    customerId: "1",
    customerName,
    phone: "+222 22 41 18 30",
    arrivedAt,
    bagCount: 10,
    testBags: 0,
    remainingBags: 0,
    project: "3",
    status: "completed",
    stage: "completed",
    source: "Chami",
    transportMethod: "truck",
    notes: "",
    transportTotal: 0,
    paid: 0,
    amountLeft: 0,
    fullyPaid: true,
    debt: 0,
  };
}

const records = [
  record("SH-1060", "Ahmed", "2026-10-09T08:15:00Z"),
  record("SH-1052", "Mariem", "2026-10-06T16:45:00Z"),
  record("SH-1012", "Ahmed", "2026-09-08T09:30:00Z"),
];

type Options = { query?: string; total?: number; clientName?: string };

function renderHistory(shown: readonly ShipmentRecord[] = records, options: Options = {}) {
  const list = listQueryFromParams(
    new URLSearchParams(options.query ?? ""),
    shipmentGroupChoices(historyStatuses),
  );
  const router = createMemoryRouter(
    [
      {
        path: HISTORY_PATH,
        element: (
          <ShipmentHistory
            project="3"
            list={list}
            filter={{
              project: "3",
              statuses: historyStatuses,
              ordering: "-arrival_date",
              search: "",
            }}
            slice={{ shipments: shown, total: options.total ?? shown.length }}
            clientName={options.clientName}
          />
        ),
      },
    ],
    { initialEntries: [`${HISTORY_PATH}?${options.query ?? ""}`] },
  );

  render(
    <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
      <RouterProvider router={router} />
    </IntlProvider>,
  );

  return { router, user: userEvent.setup() };
}

function shownShipments() {
  const [body] = within(screen.getByRole("table")).getAllByRole("rowgroup").slice(1);
  const rows = body === undefined ? [] : within(body).getAllByRole("row");

  return rows.map((row) => within(row).getAllByRole("cell")[0]?.textContent);
}

async function openFilters(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("link", { name: new RegExp(filters.button) }));
  await screen.findByRole("heading", { name: filters.button });
}

async function showResults(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: filters.show }));
}

describe("ShipmentHistory", () => {
  it("lists the shipments in the backend's order with their count and bags", () => {
    renderHistory();

    expect(shownShipments()).toEqual(["SH-1060", "SH-1052", "SH-1012"]);
    expect(screen.getByRole("status")).toHaveTextContent(history.count.replace("{count}", "3"));
    expect(screen.getByRole("row", { name: /Total/ })).toHaveTextContent("30");
  });

  it("adds the next rows on demand, with no partial total", async () => {
    let asked: string | null = null;
    server.use(
      http.get(`${window.location.origin}/api/v1/shipments/`, ({ request }) => {
        asked = new URL(request.url).searchParams.get("page");
        return HttpResponse.json({
          count: 4,
          results: [
            {
              id: 99,
              number: "SH-0999",
              customer: 7,
              customer_name: "Sidi",
              customer_phone: "+22222411830",
              arrival_date: "2026-08-01T08:00:00Z",
              bags_count: 10,
              remaining_bags: 0,
              bag_transport_cost_per_bag: "100.00",
              transport_total: "1000.00",
              amount_left_to_pay: "0.00",
              is_fully_paid: true,
              transport_method: "truck",
              source: "Chami",
              project: 3,
              status: "completed",
              is_ground: true,
            },
          ],
        });
      }),
    );
    const { user } = renderHistory(records, { total: 4 });

    expect(screen.getByRole("status")).toHaveTextContent(history.count.replace("{count}", "4"));
    expect(screen.queryByRole("row", { name: /Total/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: messages.common.showMore }));

    expect(await screen.findByText("SH-0999")).toBeVisible();
    expect(asked).toBe("2");
    expect(shownShipments()).toEqual(["SH-1060", "SH-1052", "SH-1012", "SH-0999"]);
    expect(screen.queryByRole("button", { name: messages.common.showMore })).toBeNull();
    expect(screen.getByRole("row", { name: /Total/ })).toHaveTextContent("40");
  });

  it("says so when the next rows cannot be loaded, and lets the user try again", async () => {
    server.use(
      http.get(`${window.location.origin}/api/v1/shipments/`, () =>
        HttpResponse.json({ detail: "error" }, { status: 500 }),
      ),
    );
    const { user } = renderHistory(records, { total: 4 });

    await user.click(screen.getByRole("button", { name: messages.common.showMore }));

    expect(await screen.findByText(messages.common.loadMoreFailed)).toBeVisible();
    expect(screen.getByRole("button", { name: messages.common.showMore })).toBeVisible();
  });

  it("puts the chosen dates, statuses, payment and transport in the address", async () => {
    const { router, user } = renderHistory();

    await openFilters(user);
    await user.type(screen.getByLabelText(filters.from), "01092026");
    await user.type(screen.getByLabelText(filters.to), "15092026");
    await user.click(screen.getByRole("checkbox", { name: messages.shipments.statuses.cancelled }));
    await user.click(screen.getByRole("checkbox", { name: messages.shipments.payment.incomplete }));
    await user.click(
      screen.getByRole("checkbox", { name: messages.shipments.transportMethods.hilux }),
    );
    await showResults(user);

    expect(router.state.location.search).toBe(
      "?status=cancelled&payment=unpaid&transport=hilux&from=2026-09-01&to=2026-09-15",
    );
  });

  it("finds the client on the server and filters on the one picked", async () => {
    let searched: string | null = null;
    server.use(
      http.get(`${window.location.origin}/api/v1/customers/`, ({ request }) => {
        searched = new URL(request.url).searchParams.get("search");
        return HttpResponse.json({
          count: 1,
          results: [
            {
              id: 7,
              full_name: "Ahmed",
              phone: "+22222411830",
              debt_remaining: "0.00",
              is_active: true,
              created_at: "2026-10-02T08:00:00Z",
              updated_at: "2026-10-02T08:00:00Z",
            },
          ],
        });
      }),
    );
    const { router, user } = renderHistory();

    await openFilters(user);
    await user.type(screen.getByLabelText(filters.client), "ahm");
    await user.click(await screen.findByRole("option", { name: /Ahmed/ }));
    await showResults(user);

    expect(searched).toBe("ahm");
    expect(router.state.location.search).toBe("?client=7");
  });

  it("gives one client's shipments and bags, and clears every filter", async () => {
    const { router, user } = renderHistory(records, {
      query: "client=7&status=completed",
      clientName: "Ahmed",
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      history.clientCount.replace("{shipments}", "3").replace("{bags}", "30"),
    );

    await openFilters(user);
    expect(screen.getByLabelText(filters.client)).toHaveValue("Ahmed");
    await user.click(screen.getByRole("button", { name: filters.clear }));
    expect(screen.getByLabelText(filters.client)).toHaveValue("");
    await showResults(user);

    await vi.waitFor(() => expect(router.state.location.search).toBe(""));
  });

  it("shows whether each shipment is fully paid and whether it has a debt", () => {
    renderHistory([
      { ...record("SH-2", "Sidi", "2026-09-09T09:30:00Z"), fullyPaid: true, debt: 300 },
      { ...record("SH-1", "Ahmed", "2026-09-08T09:30:00Z"), fullyPaid: false, amountLeft: 300 },
    ]);

    const [, paid, unpaid] = screen.getAllByRole("row");
    expect(screen.getByText(messages.shipments.debt.badge)).toHaveAttribute(
      "title",
      expect.stringMatching(/300/),
    );
    expect(paid).toHaveTextContent(messages.shipments.debt.badge);
    expect(paid).toHaveTextContent(messages.shipments.payment.complete);
    expect(unpaid).not.toHaveTextContent(messages.shipments.debt.badge);
    expect(unpaid).toHaveTextContent(messages.shipments.payment.incomplete);
  });

  it("opens a shipment from its row, saying it came from the history", () => {
    renderHistory();

    expect(screen.getByRole("link", { name: "SH-1012" })).toHaveAttribute(
      "href",
      "/fr/shipments/SH-1012?from=history",
    );
  });

  it("says so when nothing matches", () => {
    renderHistory([], { query: "client=7" });

    expect(screen.getByText(history.empty)).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows each shipment as completed or cancelled", () => {
    renderHistory([
      record("SH-1070", "Fatima", "2026-10-10T08:00:00Z"),
      {
        ...record("SH-1012", "Ahmed", "2026-09-08T09:30:00Z"),
        status: "cancelled",
        stage: "cancelled",
      },
    ]);

    const statuses = messages.shipments.statuses;
    expect(
      within(screen.getByRole("row", { name: /SH-1012/ })).getByText(statuses.cancelled),
    ).toBeVisible();
    expect(
      within(screen.getByRole("row", { name: /SH-1070/ })).getByText(statuses.completed),
    ).toBeVisible();
  });
});
