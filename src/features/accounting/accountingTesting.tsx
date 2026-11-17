import { render } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { noAccess } from "@/lib/access";
import type { ApiSchema } from "@/lib/api/client";
import { AccessContext } from "@/lib/accessContext";
import messages from "@/messages/fr.json";
import { AccountingProjectScreen, accountingProjectLoader } from "./AccountingProjectScreen";
import { AccountingScreen, accountingLoader } from "./AccountingScreens";

export const API = `${window.location.origin}/api/v1`;
export const server = setupServer();
export const text = messages.accounting;
export const common = messages.common;

const stamps = { created_at: "2026-11-01T08:00:00Z", updated_at: "2026-11-01T08:00:00Z" };

export const project = (id: number, name: string) => ({
  id,
  name,
  site: "zouerat",
  status: "active",
  capital: "0.00",
  is_active: true,
  ...stamps,
});

export const page = (results: readonly object[]) =>
  HttpResponse.json({ count: results.length, results });

export const profitLoss = {
  income: [{ category: "grinding_income", label: "Broyage", amount: "90000.00" }],
  expenses: [
    { category: "fuel", label: "Carburant", amount: "15000.00" },
    { category: "trucks", label: "Camions", amount: "5000.00" },
  ],
  total_income: "90000.00",
  total_expense: "20000.00",
  net_profit: "70000.00",
  by_project: [
    {
      project: 3,
      project_name: "Zouérat 1",
      project_site: "zouerat",
      income: "90000.00",
      expense: "20000.00",
      net_profit: "70000.00",
    },
    {
      project: 4,
      project_name: "Sfariyat 1",
      project_site: "sfariyat",
      income: "0.00",
      expense: "3000.00",
      net_profit: "-3000.00",
    },
  ],
};

export const pendingExpense: ApiSchema<"CashTransaction"> = {
  id: 9,
  project: 3,
  project_name: "Zouérat 1",
  project_site: "zouerat",
  transaction_type: "expense",
  transaction_type_display: "Dépense",
  category: "fuel",
  category_display: "Carburant",
  category_name: "",
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
  settlement_return: null,
  status: "pending",
  status_display: "En attente",
  is_approved: false,
  approved_at: null,
  approved_by_name: null,
  rejected_at: null,
  rejected_by_name: null,
  created_by_name: "Aicha",
  ...stamps,
};

const shipmentReturn = (
  shipment: number,
  number: string,
  returned: string | null,
  locked = false,
) => ({
  shipment,
  shipment_number: number,
  arrival_date: "2026-11-01T08:00:00Z",
  bags: "10.000",
  transport_cost: "10000.00",
  grinding_cost: "12000.00",
  refining_cost: "8000.00",
  total_cost: "30000.00",
  return_amount: returned,
  loss: returned === null ? null : String(30000 - Number(returned)),
  returned_at: returned === null ? null : "2026-11-12T09:00:00Z",
  cash_transaction: returned === null ? null : 40,
  cash_status: returned === null ? null : locked ? "approved" : "pending",
  is_locked: locked,
});

export const settlement = {
  id: 4,
  number: "STL-2026-00004",
  customer_name: "Ahmed",
  returns: [
    shipmentReturn(52, "SHP-00052", null),
    shipmentReturn(53, "SHP-00053", "30000.00", true),
  ],
};

export type Sent = { method: string; path: string; body: unknown };

export type Asked = Record<string, URLSearchParams>;

export function serveAccounting(asked: Asked, sent: Sent[] = []) {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => {
    for (const key of Object.keys(asked)) delete asked[key];
    sent.length = 0;
    const record =
      (status: number) =>
      async ({ request }: { request: Request }) => {
        sent.push({
          method: request.method,
          path: new URL(request.url).pathname.replace("/api/v1", ""),
          body: request.method === "PATCH" ? await request.json() : undefined,
        });
        return HttpResponse.json({}, { status });
      };
    const remember = (name: string, request: Request) => {
      asked[name] = new URL(request.url).searchParams;
    };

    server.use(
      http.get(`${API}/projects/`, () => page([project(3, "Zouérat 1"), project(4, "Sfariyat 1")])),
      http.get(`${API}/accounting/profit-loss/`, ({ request }) => {
        remember("profitLoss", request);
        return HttpResponse.json(profitLoss);
      }),
      http.get(`${API}/accounting/summary/`, ({ request }) => {
        remember("summary", request);
        return HttpResponse.json({
          total_income: "90000.00",
          total_expense: "20000.00",
          net_profit: "70000.00",
          total_returns: "60000.00",
          total_losses: "5000.00",
          receivables: "0.00",
          payables: "0.00",
          supplier_advances: "0.00",
          capital: "1000000.00",
          cash_balance: "1070000.00",
          unapproved_transactions: 2,
        });
      }),
      http.get(`${API}/cash-transactions/`, ({ request }) => {
        remember("pending", request);
        return page([pendingExpense]);
      }),
      http.get(`${API}/cash-transactions/9/`, () => HttpResponse.json(pendingExpense)),
      http.get(`${API}/settlements/`, ({ request }) => {
        remember("settlements", request);
        return page([settlement]);
      }),
      http.get(`${API}/accounting/receivables/`, ({ request }) => {
        remember("receivables", request);
        return HttpResponse.json({
          customers: [
            {
              customer: 7,
              customer_name: "Ahmed",
              customer_phone: "+22222411830",
              debts_due: "12000.00",
              total: "12000.00",
            },
          ],
          debts_total: "12000.00",
          total: "12000.00",
        });
      }),
      http.get(`${API}/accounting/payables/`, ({ request }) => {
        remember("payables", request);
        const supplier = (amount: string) => ({
          supplier: 5,
          supplier_name: "Sidi Fournitures",
          supplier_phone: "",
          paid_amount: "0.00",
          delivered_amount: amount,
          amount,
        });
        return HttpResponse.json({
          suppliers: [supplier("4000.00")],
          total: "4000.00",
          advances: [],
          advances_total: "0.00",
        });
      }),
      http.post(`${API}/cash-transactions/9/approve/`, record(200)),
      http.post(`${API}/cash-transactions/9/reject/`, record(200)),
      http.patch(`${API}/settlements/4/shipments/52/return/`, record(200)),
    );
  });
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
}

export function openAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: "/:locale",
        children: [
          { path: "accounting", loader: accountingLoader, element: <AccountingScreen /> },
          {
            path: "accounting/projects/:project",
            loader: accountingProjectLoader,
            element: <AccountingProjectScreen />,
          },
        ],
      },
    ],
    { initialEntries: [path] },
  );

  render(
    <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
      <AccessContext value={{ ...noAccess, superuser: true }}>
        <RouterProvider router={router} />
      </AccessContext>
    </IntlProvider>,
  );

  return router;
}
