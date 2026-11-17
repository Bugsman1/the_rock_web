import { render } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { noAccess } from "@/lib/access";
import { AccessContext } from "@/lib/accessContext";
import messages from "@/messages/fr.json";
import {
  AccountingProjectScreen,
  accountingProjectLoader,
  AccountingScreen,
  accountingLoader,
} from "./AccountingScreens";

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

const grouped = (rows: readonly object[], total: string) =>
  HttpResponse.json({ group_by: "category", rows, total, count: rows.length });

export type Asked = Record<string, URLSearchParams>;

export function serveAccounting(asked: Asked) {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => {
    for (const key of Object.keys(asked)) delete asked[key];
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
          receivables: "0.00",
          payables: "0.00",
          supplier_advances: "0.00",
          capital: "1000000.00",
          cash_balance: "1070000.00",
          unapproved_transactions: 2,
        });
      }),
      http.get(`${API}/accounting/income/`, ({ request }) => {
        remember("income", request);
        return grouped([{ key: "7", label: "Ahmed", amount: "90000.00", count: 3 }], "90000.00");
      }),
      http.get(`${API}/accounting/expenses/`, ({ request }) => {
        remember("expenses", request);
        return grouped(
          [{ key: "fuel", label: "Carburant", amount: "15000.00", count: 2 }],
          "15000.00",
        );
      }),
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
