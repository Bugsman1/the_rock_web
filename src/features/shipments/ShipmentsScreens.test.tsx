import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import messages from "@/messages/fr.json";
import type { ShipmentRecord } from "@/lib/shipments";
import { ProjectStorageScreen, projectStorageLoader, ShipmentHistory } from "./ShipmentsScreens";

const history = messages.shipments.history;
function record(shipmentNumber: string, customerName: string, arrivedAt: string): ShipmentRecord {
  return {
    id: shipmentNumber,
    shipmentNumber,
    customerName,
    phone: "+222 22 41 18 30",
    arrivedAt,
    bagCount: 10,
    project: "zouerate1",
    status: "completed",
    source: "Chami",
    notes: "",
  };
}

const records = [
  record("SH-1012", "Ahmed", "2026-09-08T09:30:00Z"),
  record("SH-1033", "Fatima", "2026-09-28T11:40:00Z"),
  record("SH-1052", "Mariem", "2026-10-06T16:45:00Z"),
  record("SH-1041", "Sidi", "2026-10-02T08:15:00Z"),
];

function renderHistory() {
  return render(
    <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
      <ShipmentHistory records={records} />
    </IntlProvider>,
  );
}

function shownShipments() {
  const [, ...rows] = within(screen.getByRole("table")).getAllByRole("row");

  return rows.map((row) => within(row).getAllByRole("cell")[0]?.textContent);
}

describe("ShipmentHistory", () => {
  it("lists every shipment of the project, newest first", () => {
    renderHistory();

    const shown = shownShipments();
    expect(shown).toHaveLength(records.length);
    expect(shown[0]).toBe("SH-1052");
    expect(screen.getByRole("status")).toHaveTextContent(String(records.length));
  });

  it("narrows the list to the typed date range", async () => {
    const user = userEvent.setup();
    renderHistory();

    await user.type(screen.getByLabelText(history.from), "01092026");
    await user.type(screen.getByLabelText(history.to), "15092026");

    expect(shownShipments()).toEqual(["SH-1012"]);
  });

  it("searches by client, phone or shipment number and clears the filters", async () => {
    const user = userEvent.setup();
    renderHistory();

    await user.type(screen.getByLabelText(messages.common.search), "sh-1033");
    expect(shownShipments()).toEqual(["SH-1033"]);

    await user.click(screen.getByRole("button", { name: history.clear }));

    expect(screen.getByLabelText(messages.common.search)).toHaveValue("");
    expect(shownShipments()).toHaveLength(records.length);
  });

  it("says so when nothing matches", async () => {
    const user = userEvent.setup();
    renderHistory();

    await user.type(screen.getByLabelText(messages.common.search), "introuvable");

    expect(screen.getByText(history.empty)).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

const API = `${window.location.origin}/api/v1`;
const server = setupServer();
const operationForm = messages.milling.operation;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const stamps = {
  is_active: true,
  created_at: "2026-10-01T08:00:00Z",
  updated_at: "2026-10-01T08:00:00Z",
};

const page = (results: readonly object[]) => HttpResponse.json({ count: results.length, results });

function apiShipment(id: number, status: string) {
  return {
    id,
    number: `SH-${id}`,
    customer_name: `Client ${id}`,
    customer_phone: "+222 22 41 18 30",
    arrival_date: `2026-10-0${id}T08:00:00Z`,
    bags_count: 10,
    bag_transport_cost_per_bag: "100.00",
    transport_method: "truck",
    source: "zouerat",
    project: 3,
    status,
    notes: "",
    created_by_name: "med",
    created_at: "2026-10-01T08:00:00Z",
    updated_at: "2026-10-01T08:00:00Z",
  };
}

function answerProject() {
  server.use(
    http.get(`${API}/projects/3/`, () =>
      HttpResponse.json({ id: 3, name: "Zouérat 1", site: "zouerat", status: "active", ...stamps }),
    ),
    http.get(`${API}/shipments/`, () =>
      page([apiShipment(1, "pending"), apiShipment(2, "grinding"), apiShipment(3, "completed")]),
    ),
  );
}

function answerGrindingChoices() {
  server.use(
    http.get(`${API}/grinders/`, () =>
      page([{ id: 7, project: 3, code: "P3-1", status: "active", ...stamps }]),
    ),
    http.get(`${API}/grinding-operations/`, () => page([])),
    http.get(`${API}/roles/`, () => page([{ id: 1, name: "manager", permissions: [] }])),
    http.get(`${API}/users/`, () =>
      page([{ id: 4, email: "a@m.mr", full_name: "Aicha", phone: "", role: 1, is_active: true }]),
    ),
  );
}

function openProject(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: "/fr/shipments/projects/:project",
        loader: projectStorageLoader,
        element: <ProjectStorageScreen />,
      },
      { path: "/fr/milling/projects/:project", element: <h1>grinding page</h1> },
    ],
    { initialEntries: [path] },
  );

  render(
    <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
      <RouterProvider router={router} />
    </IntlProvider>,
  );

  return router;
}

describe("ProjectStorageScreen", () => {
  it("lists only the shipments whose grinding has not started", async () => {
    answerProject();
    openProject("/fr/shipments/projects/3");

    expect(await screen.findByText("SH-1")).toBeVisible();
    expect(screen.queryByText("SH-2")).toBeNull();
    expect(screen.queryByText("SH-3")).toBeNull();
    expect(
      screen.getByRole("link", { name: `${messages.shipments.project.startMilling} SH-1` }),
    ).toHaveAttribute("href", "/fr/shipments/projects/3?grind=SH-1");
  });

  it("starts grinding from the shipments page and goes to the grinding page", async () => {
    answerProject();
    answerGrindingChoices();
    let created: unknown;
    let shipmentChange: unknown;
    server.use(
      http.post(`${API}/grinding-operations/`, async ({ request }) => {
        created = await request.json();
        return HttpResponse.json({}, { status: 201 });
      }),
      http.patch(`${API}/shipments/1/`, async ({ request }) => {
        shipmentChange = await request.json();
        return HttpResponse.json({});
      }),
    );
    const router = openProject("/fr/shipments/projects/3?grind=SH-1");
    const user = userEvent.setup();

    const dialog = within(await screen.findByRole("dialog", { name: operationForm.title }));
    expect(dialog.getByLabelText(operationForm.shipment)).toHaveValue("SH-1");

    await user.selectOptions(dialog.getByLabelText(operationForm.machine), "1");
    await user.type(dialog.getByLabelText(operationForm.bags), "4");
    await user.selectOptions(dialog.getByLabelText(operationForm.operator), "4");
    await user.click(dialog.getByRole("button", { name: operationForm.submit }));

    expect(await screen.findByRole("heading", { name: "grinding page" })).toBeVisible();
    expect(router.state.location.pathname).toBe("/fr/milling/projects/3");
    expect(created).toMatchObject({ shipment: 1, grinder: 7, bags_count: 4, operator: 4 });
    expect(shipmentChange).toEqual({ status: "grinding" });
  });
});
