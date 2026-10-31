import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    job_title: "CHF",
    job_title_name: "Chauffeurs",
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
    absent_days: 0,
    accrued_salary: "395860.2903225806451612903226",
    withdrawn_amount: "60000.00",
    debts_amount: "0.00",
    debts_by_salary: "0.00",
    salary_debts_amount: "0.00",
    other_debts_paid: "0.00",
    remaining_salary_debt: "0.00",
    remaining_other_debt: "0.00",
    remaining_debt: "0.00",
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

const stamps = {
  matricule: "EMP-7",
  employee_name: "Sidi Ahmed",
  created_at: "2026-09-15T08:00:00Z",
  updated_at: "2026-09-15T08:00:00Z",
};

export function apiAbsence(
  id: number,
  changes: Partial<ApiSchema<"EmployeeAbsence">> = {},
): ApiSchema<"EmployeeAbsence"> {
  return {
    id,
    employee: 7,
    start_date: "2026-10-05",
    end_date: "2026-10-07",
    days: 3,
    reason: "Malade",
    created_by_name: "admin",
    ...stamps,
    ...changes,
  };
}

export function apiDebt(
  id: number,
  changes: Partial<ApiSchema<"EmployeeDebt">> = {},
): ApiSchema<"EmployeeDebt"> {
  return {
    id,
    employee: 7,
    amount: "15000.00",
    debt_date: "2026-10-02T09:00:00Z",
    description: "Avance sur frais",
    paid_by_salary: true,
    created_by_name: "admin",
    ...stamps,
    ...changes,
  };
}

export function apiDebtPayment(
  id: number,
  changes: Partial<ApiSchema<"EmployeeDebtPayment">> = {},
): ApiSchema<"EmployeeDebtPayment"> {
  return {
    id,
    employee: 7,
    amount: "5000.00",
    method: "other",
    paid_at: "2026-10-10T12:00:00Z",
    notes: "",
    created_by_name: "admin",
    ...stamps,
    ...changes,
  };
}

export function apiMonthlySalary(
  id: number,
  changes: Partial<ApiSchema<"EmployeeMonthlySalary">> = {},
): ApiSchema<"EmployeeMonthlySalary"> {
  return {
    id,
    employee: 7,
    month: "2026-09-01",
    month_name: "septembre 2026",
    amount: "40000.00",
    credited_on: "2026-09-30",
    ...stamps,
    ...changes,
  };
}

type EmployeeRecords = {
  absences?: readonly ApiSchema<"EmployeeAbsence">[];
  debts?: readonly ApiSchema<"EmployeeDebt">[];
  payments?: readonly ApiSchema<"EmployeeDebtPayment">[];
  monthlySalaries?: readonly ApiSchema<"EmployeeMonthlySalary">[];
};

function ofEmployee<Row extends { employee: number }>(path: string, rows: readonly Row[]) {
  return http.get(`${API}/${path}/`, ({ request }) => {
    const employee = new URL(request.url).searchParams.get("employee");
    const results = rows.filter((row) => String(row.employee) === employee);

    return HttpResponse.json({ count: results.length, results });
  });
}

export function serveEmployeeRecords({
  absences = [],
  debts = [],
  payments = [],
  monthlySalaries = [],
}: EmployeeRecords) {
  server.use(
    ofEmployee("employee-absences", absences),
    ofEmployee("employee-debts", debts),
    ofEmployee("employee-debt-payments", payments),
    ofEmployee("employee-monthly-salaries", monthlySalaries),
  );
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
    ofEmployee("employee-withdrawals", withdrawals),
  );
  serveEmployeeRecords({});
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

export function rowsOf(title: string) {
  const panel = screen.getByText(title, { selector: "h2" }).closest("section");

  if (panel === null) {
    throw new Error(`${title} panel missing`);
  }

  return within(panel).getAllByRole("row").slice(1);
}

export function capture(method: "post" | "patch", path: string, answer = HttpResponse.json({})) {
  const sent: unknown[] = [];

  server.use(
    http[method](`${API}${path}`, async ({ request }) => {
      sent.push(await request.json());
      return answer;
    }),
  );

  return sent;
}

export async function openTab(name: string) {
  await userEvent.click(await screen.findByRole("tab", { name }));
}
