import { render, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { afterAll, afterEach, beforeAll } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { noAccess } from "@/lib/access";
import { AccessContext } from "@/lib/accessContext";
import { formatMoney } from "@/lib/format";
import messages from "@/messages/fr.json";
import { EmployeeScreen, employeeLoader } from "./EmployeeScreen";
import {
  EmployeesProjectScreen,
  employeesProjectLoader,
  EmployeesScreen,
  employeesLoader,
} from "./EmployeesScreens";

const API = `${window.location.origin}/api/v1`;
const server = setupServer();

export const text = messages.employees;
export const common = messages.common;

function apiProject(id: number) {
  return {
    id,
    name: `Projet ${id}`,
    site: "zouerat",
    status: "active",
    is_active: true,
    created_at: "2026-10-01T08:00:00Z",
    updated_at: "2026-10-01T08:00:00Z",
  };
}

export function serveProjects(ids: readonly number[]) {
  server.use(
    http.get(`${API}/projects/`, () =>
      HttpResponse.json({ count: ids.length, results: ids.map(apiProject) }),
    ),
    http.get(`${API}/projects/:id/`, ({ params }) =>
      HttpResponse.json(apiProject(Number(params.id))),
    ),
  );
}

export function serveEmployees() {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
}

export function openAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: "/:locale",
        children: [
          { path: "employees", loader: employeesLoader, element: <EmployeesScreen /> },
          {
            path: "employees/projects/:project",
            loader: employeesProjectLoader,
            element: <EmployeesProjectScreen />,
          },
          { path: "employees/:employee", loader: employeeLoader, element: <EmployeeScreen /> },
        ],
      },
    ],
    { initialEntries: [path] },
  );

  render(
    <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
      <AccessContext value={{ ...noAccess, superuser: true }}>
        <ToastProvider anchor={{ current: null }}>
          <RouterProvider router={router} />
        </ToastProvider>
      </AccessContext>
    </IntlProvider>,
  );

  return router;
}

export function money(amount: number): string {
  return formatMoney(amount, "fr").replace(/\s/g, " ");
}

export function cellsOf(row: HTMLElement | undefined) {
  if (row === undefined) {
    throw new Error("row missing");
  }

  return within(row)
    .getAllByRole("cell")
    .map((cell) => cell.textContent.replace(/\s/g, " "));
}
