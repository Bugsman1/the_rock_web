import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { noAccess } from "@/lib/access";
import { AccessContext } from "@/lib/accessContext";
import messages from "@/messages/fr.json";
import type { ShipmentRecord } from "@/lib/shipments";
import { ProjectStorageScreen, projectStorageLoader, ShipmentHistory } from "./ShipmentsScreens";

const allRights = { ...noAccess, superuser: true };

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
    transportTotal: 0,
    paid: 0,
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

  it("shows whether each shipment is fully paid", () => {
    render(
      <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
        <ShipmentHistory
          records={[
            { ...record("SH-1", "Ahmed", "2026-09-08T09:30:00Z"), transportTotal: 500, paid: 200 },
            { ...record("SH-2", "Sidi", "2026-09-09T09:30:00Z"), transportTotal: 500, paid: 500 },
          ]}
        />
      </IntlProvider>,
    );

    const [, paid, unpaid] = screen.getAllByRole("row");
    expect(paid).toHaveTextContent("SH-2");
    expect(paid).toHaveTextContent(messages.shipments.payment.complete);
    expect(unpaid).toHaveTextContent("SH-1");
    expect(unpaid).toHaveTextContent(messages.shipments.payment.incomplete);
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
    http.get(`${API}/grinding-operations/`, () =>
      page([
        {
          id: 9,
          shipment_number: "SH-2",
          customer_name: "Client 2",
          grinder_code: "P3-1",
          project_name: "Zouérat 1",
          bags_count: 1.5,
          start_time: "2026-10-08T06:00:00Z",
          end_time: null,
          operator_name: "Ahmed",
          grinding_cost: "22500",
          notes: "",
          ...stamps,
        },
      ]),
    ),
  );
}

function answerGrindingChoices() {
  server.use(
    http.get(`${API}/grinders/`, () =>
      page([{ id: 7, project: 3, code: "P3-1", status: "active", ...stamps }]),
    ),
    http.get(`${API}/grinding-operations/`, () => page([])),
    http.get(`${API}/operators/`, () => HttpResponse.json([{ id: 4, name: "Aicha" }])),
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
      <AccessContext value={allRights}>
        <RouterProvider router={router} />
      </AccessContext>
    </IntlProvider>,
  );

  return router;
}

describe("ProjectStorageScreen", () => {
  it("finds a stored shipment by client, phone or number, keeping its place in line", async () => {
    server.use(
      http.get(`${API}/grinding-operations/`, () => page([])),
      http.get(`${API}/projects/3/`, () =>
        HttpResponse.json({
          id: 3,
          name: "Zouérat 1",
          site: "zouerat",
          status: "active",
          ...stamps,
        }),
      ),
      http.get(`${API}/shipments/`, () =>
        page([
          apiShipment(1, "pending"),
          { ...apiShipment(2, "pending"), customer_phone: "+222 46 00 00 01" },
        ]),
      ),
    );
    const user = userEvent.setup();
    openProject("/fr/shipments/projects/3");

    const search = await screen.findByLabelText(
      messages.common.searchIn.replace("{list}", messages.shipments.project.queueTitle),
    );
    await user.type(search, "46 00");

    const [, row] = screen.getAllByRole("row");
    expect(row).toHaveTextContent("2SH-2");
    expect(screen.queryByText("SH-1")).toBeNull();

    await user.clear(search);
    await user.type(search, "personne");
    expect(screen.getByText(messages.common.noMatch)).toBeVisible();
  });

  it("lists the shipments still to grind with their bags left, like the grinding queue", async () => {
    answerProject();
    openProject("/fr/shipments/projects/3");

    expect(await screen.findByText("SH-1")).toBeVisible();
    const [, waiting, started] = screen.getAllByRole("row");
    expect(waiting).toHaveTextContent("10 sur 10");
    expect(waiting).toHaveTextContent(messages.shipments.statuses.pending);
    expect(started).toHaveTextContent("SH-2");
    expect(started).toHaveTextContent("8,5 sur 10");
    expect(started).toHaveTextContent(messages.shipments.statuses.grinding);
    expect(screen.queryByText("SH-3")).toBeNull();
    expect(waiting).toHaveTextContent(messages.shipments.payment.incomplete);
    expect(
      screen.getByRole("link", { name: `${messages.shipments.project.startMilling} SH-1` }),
    ).toHaveAttribute("href", "/fr/shipments/projects/3?grind=SH-1");
  });

  it("asks the invoice language from the PDF button and says so when the download fails", async () => {
    answerProject();
    let asked: string | null = null;
    server.use(
      http.get(`${API}/shipments/1/invoice/`, ({ request }) => {
        asked = new URL(request.url).searchParams.get("lang");
        return HttpResponse.json({ detail: "error" }, { status: 500 });
      }),
    );
    const user = userEvent.setup();
    openProject("/fr/shipments/projects/3");

    await user.click(
      await screen.findByRole("button", {
        name: messages.shipments.invoice.open.replace("{number}", "SH-1"),
      }),
    );
    const languages = within(
      screen.getByRole("group", {
        name: messages.shipments.invoice.languages.replace("{number}", "SH-1"),
      }),
    );
    await user.click(languages.getByRole("button", { name: messages.shipments.invoice.ar }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      messages.shipments.form.saved.failed,
    );
    expect(asked).toBe("ar");
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
    await user.type(dialog.getByLabelText(operationForm.bags), "2");
    await user.selectOptions(dialog.getByLabelText(operationForm.operator), "4");
    await user.click(dialog.getByRole("button", { name: operationForm.submit }));

    expect(await screen.findByRole("heading", { name: "grinding page" })).toBeVisible();
    expect(router.state.location.pathname).toBe("/fr/milling/projects/3");
    expect(created).toMatchObject({ shipment: 1, grinder: 7, bags_count: 2, operator: 4 });
    expect(shipmentChange).toEqual({ status: "grinding" });
  });
});
