import { render, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { noAccess, rightsFromApi } from "@/lib/access";
import type { Access } from "@/lib/access";
import { AccessContext } from "@/lib/accessContext";
import messages from "@/messages/fr.json";
import { SupplierScreen, supplierLoader } from "./SupplierScreen";
import { SuppliersScreen, suppliersLoader } from "./SuppliersScreen";

export const API = `${window.location.origin}/api/v1`;
export const server = setupServer();
export const text = messages.suppliers;
export const common = messages.common;
export const kinds = messages.resourceKinds;

const allRights: Access = { ...noAccess, superuser: true };

export const viewOnly: Access = {
  ...noAccess,
  rights: rightsFromApi([{ module: "suppliers", can_view: true }]),
};

const stamps = { created_at: "2026-10-12T08:00:00Z", updated_at: "2026-10-12T08:00:00Z" };

export const page = (results: readonly object[]) =>
  HttpResponse.json({ count: results.length, results });

export const apiSupplier = {
  id: 5,
  name: "Sidi Fournitures",
  phone: "+22222411830",
  notes: "",
  paid_amount: "1000.00",
  delivered_amount: "1300.00",
  balance: "-300.00",
  resources: [
    { id: 2, name: "mercury", project: 3, project_name: "Zouérat 1", is_stockable: true },
  ],
  ...stamps,
};

export const paymentEntry = {
  type: "payment",
  id: 7,
  date: "2026-10-12T09:00:00Z",
  amount: "1000.00",
  resource: null,
  resource_name: null,
  quantity: null,
  is_initial: false,
  notes: "Avance",
  created_by_name: "Aicha",
  recorded_at: "2026-10-12T09:00:00Z",
  balance: "1000.00",
};

export const deliveryEntry = {
  ...paymentEntry,
  type: "delivery",
  id: 4,
  date: "2026-10-12T10:00:00Z",
  amount: "1300.00",
  resource: 2,
  resource_name: "mercury",
  quantity: "100.000",
  notes: "",
  recorded_at: "2026-10-12T10:00:00Z",
  balance: "-300.00",
};

export const apiPayment = {
  id: 7,
  supplier: 5,
  supplier_name: "Sidi Fournitures",
  amount: "1000.00",
  paid_at: "2026-10-12T09:00:00Z",
  notes: "Avance",
  created_by_name: "Aicha",
  ...stamps,
};

export const apiDelivery = {
  id: 4,
  supplier: 5,
  supplier_name: "Sidi Fournitures",
  resource: 2,
  resource_name: "mercury",
  is_stockable: true,
  project: 3,
  project_name: "Zouérat 1",
  quantity: "100.000",
  price: "1300.00",
  delivered_at: "2026-10-12T10:00:00Z",
  notes: "",
  is_initial: false,
  created_by_name: "Aicha",
  ...stamps,
};

export type Sent = { method: string; path: string; body: unknown; key: string | null };

export function serveSuppliers(sent: Sent[]) {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => {
    sent.length = 0;
    const record =
      (status: number, reply: object | null) =>
      async ({ request }: { request: Request }) => {
        sent.push({
          method: request.method,
          path: new URL(request.url).pathname.replace("/api/v1", ""),
          body: request.method === "DELETE" ? undefined : await request.json(),
          key: request.headers.get("Idempotency-Key"),
        });
        return reply === null
          ? new HttpResponse(null, { status })
          : HttpResponse.json(reply, { status });
      };

    server.use(
      http.get(`${API}/suppliers/`, () => page([apiSupplier])),
      http.get(`${API}/suppliers/5/`, () => HttpResponse.json(apiSupplier)),
      http.get(`${API}/suppliers/5/history/`, () =>
        HttpResponse.json([paymentEntry, deliveryEntry]),
      ),
      http.get(`${API}/supplier-payments/7/`, () => HttpResponse.json(apiPayment)),
      http.get(`${API}/supplier-deliveries/4/`, () => HttpResponse.json(apiDelivery)),
      http.post(`${API}/suppliers/`, record(201, { ...apiSupplier, id: 6 })),
      http.patch(`${API}/suppliers/5/`, record(200, apiSupplier)),
      http.delete(`${API}/suppliers/5/`, record(204, null)),
      http.post(`${API}/supplier-payments/`, record(201, apiPayment)),
      http.patch(`${API}/supplier-payments/7/`, record(200, apiPayment)),
      http.delete(`${API}/supplier-payments/7/`, record(204, null)),
      http.post(`${API}/supplier-deliveries/`, record(201, apiDelivery)),
      http.patch(`${API}/supplier-deliveries/4/`, record(200, apiDelivery)),
      http.delete(`${API}/supplier-deliveries/4/`, record(204, null)),
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
          { path: "suppliers", loader: suppliersLoader, element: <SuppliersScreen /> },
          { path: "suppliers/:supplier", loader: supplierLoader, element: <SupplierScreen /> },
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
