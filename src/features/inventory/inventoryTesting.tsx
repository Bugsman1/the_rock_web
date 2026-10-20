import { render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { noAccess } from "@/lib/access";
import type { Access } from "@/lib/access";
import { AccessContext } from "@/lib/accessContext";
import messages from "@/messages/fr.json";
import {
  InventoryProjectScreen,
  inventoryProjectLoader,
  InventoryScreen,
  inventoryLoader,
} from "./InventoryScreens";
import { ResourceScreen, resourceLoader } from "./ResourceScreen";

const allRights: Access = { ...noAccess, superuser: true };

export const API = `${window.location.origin}/api/v1`;
export const server = setupServer();
export const text = messages.inventory;

export const page = (results: readonly object[]) =>
  HttpResponse.json({ count: results.length, results });

const zouerat = {
  id: 3,
  name: "Zouérat 1",
  site: "zouerat",
  status: "active",
  is_active: true,
  created_at: "2026-10-01T08:00:00Z",
  updated_at: "2026-10-01T08:00:00Z",
};

export const mercury = {
  id: 2,
  project: 3,
  project_name: "Zouérat 1",
  name: "Mercure",
  initial_quantity: "10.000",
  current_quantity: "8.500",
  created_at: "2026-10-12T08:00:00Z",
  updated_at: "2026-10-12T08:00:00Z",
};

export const decrease = {
  id: 11,
  resource: 2,
  resource_name: "Mercure",
  project_name: "Zouérat 1",
  change_type: "decrease",
  quantity: "1.500",
  quantity_before: "10.000",
  quantity_after: "8.500",
  refining_operation: 5,
  shipment_number: "SH-4",
  grinding_operation: null,
  grinding_sequence: null,
  grinder_code: null,
  loss: null,
  note: "Lot 4",
  created_by_name: "Aicha",
  created_at: "2026-10-12T11:00:00Z",
};

export const initial = {
  ...decrease,
  id: 10,
  change_type: "initial",
  quantity: "10.000",
  quantity_before: "0.000",
  quantity_after: "10.000",
  refining_operation: null,
  shipment_number: null,
  note: "",
  created_by_name: "",
  created_at: "2026-10-12T08:00:00Z",
};

export const taken = {
  ...decrease,
  id: 13,
  change_type: "taken",
  quantity: "120.000",
  quantity_before: "500.000",
  quantity_after: "380.000",
  refining_operation: null,
  grinding_operation: 7,
  grinding_sequence: 2,
  grinder_code: "P3-7",
  note: "",
  created_at: "2026-10-12T09:00:00Z",
};

export const returned = {
  ...taken,
  id: 14,
  change_type: "returned",
  quantity: "118.250",
  quantity_before: "380.000",
  quantity_after: "498.250",
  refining_operation: 6,
  loss: "1.750",
  created_at: "2026-10-12T10:00:00Z",
};

export function serveInventory() {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => {
    server.use(
      http.get(`${API}/projects/`, () =>
        page([zouerat, { ...zouerat, id: 4, name: "Sfariyat 1" }]),
      ),
      http.get(`${API}/projects/3/`, () => HttpResponse.json(zouerat)),
      http.get(`${API}/resources/`, () => page([mercury])),
      http.get(`${API}/resources/2/`, () => HttpResponse.json(mercury)),
      http.get(`${API}/resource-history/`, () => page([decrease, initial])),
    );
  });
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
}

export function openAt(path: string, access: Access = allRights) {
  const router = createMemoryRouter(
    [
      {
        path: "/fr",
        children: [
          { path: "inventory", loader: inventoryLoader, element: <InventoryScreen /> },
          {
            path: "inventory/projects/:project",
            loader: inventoryProjectLoader,
            element: <InventoryProjectScreen />,
          },
          {
            path: "inventory/resources/:resource",
            loader: resourceLoader,
            element: <ResourceScreen />,
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
}

export function cellsOf(row: HTMLElement | undefined) {
  if (row === undefined) {
    throw new Error("row missing");
  }

  return within(row)
    .getAllByRole("cell")
    .map((cell) => cell.textContent);
}

export function cardOf(title: string) {
  const card = screen.getByRole("heading", { name: title }).closest("section");

  if (card === null) {
    throw new Error(`no card ${title}`);
  }

  return within(card);
}

export async function findCardOf(title: string) {
  await screen.findByRole("heading", { name: title });

  return cardOf(title);
}
