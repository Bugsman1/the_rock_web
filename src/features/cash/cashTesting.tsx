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
import { CashProjectScreen, cashProjectLoader } from "./CashProjectScreen";
import { CashScreen, cashLoader } from "./CashScreen";

export const API = `${window.location.origin}/api/v1`;
export const server = setupServer();
export const text = messages.cash;
export const common = messages.common;

const allRights: Access = { ...noAccess, superuser: true };

export const viewOnly: Access = {
  ...noAccess,
  rights: rightsFromApi([{ module: "cash", can_view: true }]),
};

const stamps = { created_at: "2026-11-10T08:00:00Z", updated_at: "2026-11-10T08:00:00Z" };

export const page = (results: readonly object[], count = results.length) =>
  HttpResponse.json({ count, results });

export const apiTransaction = {
  id: 9,
  project: 3,
  project_name: "Zouérat 1",
  project_site: "zouerat",
  transaction_type: "expense",
  transaction_type_display: "Dépense",
  category: "fuel",
  category_display: "Carburant",
  amount: "15000.00",
  transaction_date: "2026-11-12T09:30:00Z",
  description: "Gasoil groupe",
  customer: null,
  customer_name: "",
  supplier: 5,
  supplier_name: "Sidi Fournitures",
  employee: null,
  employee_name: "",
  grinder: null,
  grinder_code: "",
  source: "manual",
  supplier_payment: null,
  debt_payment: null,
  shipment_payment: null,
  settlement_payment: null,
  is_approved: false,
  approved_at: null,
  approved_by_name: null,
  created_by_name: "Aicha",
  ...stamps,
};

export const automaticTransaction = {
  ...apiTransaction,
  id: 10,
  transaction_type: "income",
  category: "customer_debt_payment",
  category_display: "Paiement de dette client",
  amount: "40000.00",
  description: "Remboursement",
  customer: 7,
  customer_name: "Ahmed",
  supplier: null,
  supplier_name: "",
  source: "debt_payment",
  debt_payment: 4,
};

const category = (value: string, label: string, type: string, automatic = false) => ({
  value,
  label,
  transaction_type: type,
  is_automatic: automatic,
});

export const apiCategories = [
  category("grinding_income", "Broyage", "income"),
  category("customer_debt_payment", "Paiement de dette client", "income", true),
  category("wages", "Salaires de production", "expense"),
  category("fuel", "Carburant", "expense"),
  category("supplier_payment", "Paiement fournisseur", "expense", true),
  category("trucks", "Camions", "expense"),
  category("daily_expenses", "Dépenses quotidiennes", "expense"),
  category("other_expense", "Autres dépenses", "expense"),
];

export const project = (id: number, name: string, site: string) => ({
  id,
  name,
  site,
  status: "active",
  capital: "0.00",
  is_active: true,
  ...stamps,
});

export const apiBalance = {
  project: 3,
  project_name: "Zouérat 1",
  project_site: "zouerat",
  capital: "1000000.00",
  income: "40000.00",
  expense: "15000.00",
  net: "25000.00",
  balance: "1025000.00",
};

export type Sent = { method: string; path: string; body: unknown; key: string | null };

export function serveCash(sent: Sent[]) {
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
      http.get(`${API}/cash-transactions/balance/`, () =>
        HttpResponse.json([
          apiBalance,
          {
            project: 4,
            project_name: "Sfariyat 1",
            project_site: "sfariyat",
            capital: "0.00",
            income: "0.00",
            expense: "2000.00",
            net: "-2000.00",
            balance: "-2000.00",
          },
        ]),
      ),
      http.get(`${API}/cash-transactions/categories/`, () => HttpResponse.json(apiCategories)),
      http.get(`${API}/cash-transactions/`, () => page([apiTransaction, automaticTransaction])),
      http.get(`${API}/cash-transactions/9/`, () => HttpResponse.json(apiTransaction)),
      http.get(`${API}/cash-transactions/10/`, () => HttpResponse.json(automaticTransaction)),
      http.get(`${API}/projects/`, () =>
        page([project(3, "Zouérat 1", "zouerat"), project(4, "Sfariyat 1", "sfariyat")]),
      ),
      http.get(`${API}/suppliers/`, () =>
        page([
          {
            id: 5,
            name: "Sidi Fournitures",
            paid_amount: "0.00",
            delivered_amount: "0.00",
            balance: "0.00",
            resources: [],
            ...stamps,
          },
        ]),
      ),
      http.get(`${API}/customers/`, () =>
        page([{ id: 7, full_name: "Ahmed", phone: "+22222411830", ...stamps }]),
      ),
      http.get(`${API}/customers/7/`, () =>
        HttpResponse.json({ id: 7, full_name: "Ahmed", phone: "+22222411830", ...stamps }),
      ),
      http.post(`${API}/cash-transactions/`, record(201, apiTransaction)),
      http.patch(`${API}/cash-transactions/9/`, record(200, apiTransaction)),
      http.delete(`${API}/cash-transactions/9/`, record(204, null)),
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
          { path: "cash", loader: cashLoader, element: <CashScreen /> },
          {
            path: "cash/projects/:project",
            loader: cashProjectLoader,
            element: <CashProjectScreen />,
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
