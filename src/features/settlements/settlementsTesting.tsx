import { render, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { noAccess } from "@/lib/access";
import type { Access } from "@/lib/access";
import { AccessContext } from "@/lib/accessContext";
import type { RefiningOperation } from "@/lib/refining";
import type { ShipmentRecord } from "@/lib/shipments";
import messages from "@/messages/fr.json";
import { NewSettlementScreen, newSettlementLoader } from "./NewSettlementScreen";
import { SettlementProjectScreen, settlementProjectLoader } from "./SettlementProjectScreen";
import { SettlementScreen, settlementLoader } from "./SettlementScreen";
import { SettlementsScreen, settlementsLoader } from "./SettlementsScreen";

export const allRights: Access = { ...noAccess, superuser: true };

export const API = `${window.location.origin}/api/v1`;
export const server = setupServer();
export const text = messages.settlements;

export const page = (results: readonly object[]) =>
  HttpResponse.json({ count: results.length, results });

const stamps = { created_at: "2026-10-18T09:00:00Z", updated_at: "2026-10-18T09:00:00Z" };

export const apiSettlement = {
  id: 4,
  number: "STL-2026-00004",
  customer_name: "Ahmed",
  customer_phone: "+222 22 41 18 30",
  project: 3,
  project_name: "Zouérat 1",
  shipments: [1, 2],
  shipment_numbers: ["SHP-00001", "SHP-00002"],
  grinding_cost_per_bag: "250.00",
  refining_cost_per_gram: "1500.00",
  debt: "2000.00",
  debt_description: "Avance sur carburant",
  totals: {
    bags: "20.000",
    bags_transport: "21000.00",
    passengers_transport: "3000.00",
    gold: "12.250",
    debt: "250.00",
    grinding_cost: "5000.00",
    refining_cost: "18375.00",
    extra_debt: "2000.00",
    grand_total: "49625.00",
  },
  created_by_name: "Sidi",
  ...stamps,
};

export function apiShipment(id: number, status: string, project = 3) {
  return {
    id,
    number: `SHP-0000${id}`,
    invoice_number: null,
    invoiced_at: null,
    customer: 7,
    customer_name: "Ahmed",
    customer_phone: "+222 22 41 18 30",
    arrival_date: `2026-10-0${id}T08:00:00Z`,
    bags_count: 10.5,
    bag_transport_cost_per_bag: "100.00",
    passengers_count: 0,
    passenger_transport_cost_per_person: "0.00",
    current_payment: "0.00",
    debt: "0.00",
    payments: [],
    transport_method: "truck",
    source: "Chami",
    project,
    status,
    is_ground: status === "completed",
    notes: "",
    created_by_name: "med",
    ...stamps,
  };
}

export function shipmentRecord(overrides: Partial<ShipmentRecord>): ShipmentRecord {
  return {
    id: "1",
    shipmentNumber: "SHP-00001",
    customerName: "Ahmed",
    phone: "+222 22 41 18 30",
    arrivedAt: "2026-10-01T08:00:00Z",
    bagCount: 10,
    testBags: 0,
    project: "3",
    status: "completed",
    stage: "completed",
    source: "Chami",
    notes: "",
    transportTotal: 1000,
    paid: 0,
    debt: 0,
    ...overrides,
  };
}

const ahmed = { id: 7, full_name: "Ahmed", phone: "+222 22 41 18 30", is_active: true, ...stamps };

export const projects = [
  { id: 3, name: "Zouérat 1", site: "zouerat", status: "active", is_active: true, ...stamps },
  { id: 5, name: "Sfariyat 1", site: "sfariyat", status: "active", is_active: true, ...stamps },
];

export function serveSettlements() {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => {
    server.use(
      http.get(`${API}/settlements/`, () => page([apiSettlement])),
      http.get(`${API}/settlements/4/`, () => HttpResponse.json(apiSettlement)),
      http.get(`${API}/customers/`, () => page([ahmed])),
      http.get(`${API}/projects/`, () => page(projects)),
      http.get(`${API}/projects/:id/`, ({ params }) => {
        const found = projects.find((project) => String(project.id) === params.id);
        return found === undefined
          ? new HttpResponse(null, { status: 404 })
          : HttpResponse.json(found);
      }),
      http.get(`${API}/shipments/`, () => page([])),
      http.get(`${API}/refining-operations/`, () => page([])),
    );
  });
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
}

export function openAt(path: string, access: Access = allRights) {
  const router = createMemoryRouter(
    [
      {
        path: "/:locale",
        children: [
          { path: "settlements", loader: settlementsLoader, element: <SettlementsScreen /> },
          {
            path: "settlements/new",
            loader: newSettlementLoader,
            element: <NewSettlementScreen />,
          },
          {
            path: "settlements/projects/:project",
            loader: settlementProjectLoader,
            element: <SettlementProjectScreen />,
          },
          {
            path: "settlements/:settlement",
            loader: settlementLoader,
            element: <SettlementScreen />,
          },
        ],
      },
    ],
    { initialEntries: [path] },
  );

  render(
    <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
      <AccessContext value={access}>
        <RouterProvider router={router} />
      </AccessContext>
    </IntlProvider>,
  );

  return router;
}

export function cellsOf(row: HTMLElement | undefined) {
  if (row === undefined) {
    throw new Error("row missing");
  }

  return within(row)
    .getAllByRole("cell")
    .map((cell) => cell.textContent);
}

export function refiningOf(shipmentNumber: string, goldWithoutMaterial: number): RefiningOperation {
  return {
    id: `${shipmentNumber}-${goldWithoutMaterial}`,
    grindingOperationId: "1",
    shipmentNumber,
    client: "Ahmed",
    grinderCode: "P3-1",
    project: "3",
    projectName: "Zouérat 1",
    workerName: "Aicha",
    bags: 2,
    refinedAt: "2026-10-05T08:00:00Z",
    weightBefore: 120,
    weightAfter: 118,
    goldWithMaterial: 5,
    goldWithoutMaterial,
    loss: 2,
    lossReason: "normalShortage",
    notes: "",
  };
}

export function apiRefiningOf(id: number, shipmentNumber: string, goldWithoutMaterial: string) {
  return {
    id,
    grinding_operation: id,
    shipment_number: shipmentNumber,
    customer_name: "Ahmed",
    grinder_code: "P3-1",
    project_name: "Zouérat 1",
    worker_name: "Aicha",
    bags_count: 2,
    refining_date: "2026-10-05T08:00:00Z",
    weight_before: "120.000",
    weight_after: "118.000",
    gold_weight: goldWithoutMaterial,
    gold_weight_with_mercury: "5.000",
    gold_weight_without_mercury: goldWithoutMaterial,
    loss: "2.000",
    loss_reason: "normalShortage",
    notes: "",
    ...stamps,
  };
}
