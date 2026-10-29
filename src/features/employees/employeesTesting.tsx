import { render, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { afterAll, afterEach, beforeAll } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { noAccess, rightsFromApi } from "@/lib/access";
import type { Access } from "@/lib/access";
import { AccessContext } from "@/lib/accessContext";
import type { ApiSchema } from "@/lib/api/client";
import { formatMoney } from "@/lib/format";
import messages from "@/messages/fr.json";
import { EmployeeScreen, employeeLoader } from "./EmployeeScreen";
import {
  EmployeesProjectScreen,
  employeesProjectLoader,
  EmployeesScreen,
  employeesLoader,
} from "./EmployeesScreens";

export const API = `${window.location.origin}/api/v1`;
export const server = setupServer();

export const text = messages.employees;
export const common = messages.common;

export const viewOnly: Access = {
  ...noAccess,
  rights: rightsFromApi([{ module: "employees", can_view: true }]),
};

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

export function apiEmployee(
  id: number,
  changes: Partial<ApiSchema<"Employee">> = {},
): ApiSchema<"Employee"> {
  return {
    id,
    matricule: `EMP-${id}`,
    full_name: "Sidi Ahmed",
    job_title: "Chauffeur",
    project: 11,
    project_name: "Projet 11",
    phone: "+22236520714",
    monthly_salary: "40000.00",
    salaries: [
      { id: 1, monthly_salary: "39999.00", effective_from: "2026-01-01", notes: "" },
      { id: 2, monthly_salary: "40000.00", effective_from: "2026-10-01", notes: "" },
    ],
    start_date: "2026-01-01T08:00:00Z",
    end_date: null,
    accrued_until: "2026-10-28",
    accrued_salary: "395860.2903225806451612903226",
    withdrawn_amount: "60000.00",
    balance: "335860.2903225806451612903226",
    accumulated_salary: "335860.2903225806451612903226",
    debt: "0",
    created_by_name: "admin",
    created_at: "2026-01-01T08:00:00Z",
    updated_at: "2026-01-01T08:00:00Z",
    ...changes,
  };
}

export function apiWithdrawal(
  id: number,
  changes: Partial<ApiSchema<"EmployeeWithdrawal">> = {},
): ApiSchema<"EmployeeWithdrawal"> {
  return {
    id,
    employee: 7,
    matricule: "EMP-7",
    employee_name: "Sidi Ahmed",
    amount: "20000.00",
    withdrawal_date: "2026-09-15T10:30:00Z",
    notes: "",
    created_by_name: "admin",
    created_at: "2026-09-15T08:00:00Z",
    updated_at: "2026-09-15T08:00:00Z",
    ...changes,
  };
}

export function serveEmployeeData(
  employees: readonly ApiSchema<"Employee">[],
  withdrawals: readonly ApiSchema<"EmployeeWithdrawal">[] = [],
) {
  server.use(
    http.get(`${API}/employees/`, ({ request }) => {
      const project = new URL(request.url).searchParams.get("project");
      const results = employees.filter(
        (employee) => project === null || String(employee.project) === project,
      );

      return HttpResponse.json({ count: results.length, results });
    }),
    http.get(`${API}/employees/:id/`, ({ params }) => {
      const employee = employees.find((candidate) => String(candidate.id) === params.id);

      return employee === undefined
        ? HttpResponse.json({ detail: "Not found." }, { status: 404 })
        : HttpResponse.json(employee);
    }),
    http.get(`${API}/employee-withdrawals/`, ({ request }) => {
      const employee = new URL(request.url).searchParams.get("employee");
      const results = withdrawals.filter((withdrawal) => String(withdrawal.employee) === employee);

      return HttpResponse.json({ count: results.length, results });
    }),
  );
}

export function serveEmployees() {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
}

export function openAt(path: string, access: Access = { ...noAccess, superuser: true }) {
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
      <AccessContext value={access}>
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
