import type { SaveResult } from "@/lib/api/client";
import { formatPhone } from "@/lib/phone";
import { isRecordId } from "@/lib/projects";
import type { ProjectId } from "@/lib/projects";
import type { IsoTimestamp } from "@/lib/format";
import type { Employee, EmployeeValues, Withdrawal, WithdrawalValues } from "./employees";
import { placeholderEmployees } from "./placeholderEmployees";

type StoredEmployee = Omit<Employee, "withdrawn" | "balance">;

const PROJECT_ID_FACTOR = 100;

const employees: StoredEmployee[] = [];
const withdrawals: Withdrawal[] = [];
const seededProjects = new Set<ProjectId>();
let nextId = 900_050;

function newId(): string {
  nextId += PROJECT_ID_FACTOR;
  return String(nextId);
}

function seed(project: ProjectId) {
  if (seededProjects.has(project)) {
    return;
  }

  seededProjects.add(project);
  placeholderEmployees.forEach(({ withdrawals: own, ...employee }, index) => {
    const id = String(Number(project) * PROJECT_ID_FACTOR + index + 1);

    employees.push({ ...employee, id, project });
    own.forEach((withdrawal, position) =>
      withdrawals.push({ ...withdrawal, id: `${id}${position + 1}`, employee: id }),
    );
  });
}

function withBalance(employee: StoredEmployee): Employee {
  const withdrawn = withdrawals
    .filter((withdrawal) => withdrawal.employee === employee.id)
    .reduce((total, withdrawal) => total + withdrawal.amount, 0);

  return { ...employee, withdrawn, balance: employee.earned - withdrawn };
}

export async function getEmployees(projects: readonly ProjectId[]): Promise<readonly Employee[]> {
  projects.forEach(seed);

  return employees.filter((employee) => projects.includes(employee.project)).map(withBalance);
}

export async function getEmployee(id: string): Promise<Employee | undefined> {
  if (!isRecordId(id)) {
    return undefined;
  }

  const sample = Number(id) % PROJECT_ID_FACTOR;

  if (sample >= 1 && sample <= placeholderEmployees.length) {
    seed(String(Math.floor(Number(id) / PROJECT_ID_FACTOR)));
  }

  const employee = employees.find((candidate) => candidate.id === id);

  return employee === undefined ? undefined : withBalance(employee);
}

export async function getWithdrawals(employee: string): Promise<readonly Withdrawal[]> {
  return withdrawals
    .filter((withdrawal) => withdrawal.employee === employee)
    .toSorted((first, second) => second.at.localeCompare(first.at));
}

function employeeFromValues(values: EmployeeValues) {
  return {
    matricule: values.matricule.trim(),
    name: values.name.trim(),
    job: values.job,
    phone: formatPhone(values.phone),
    monthlySalary: values.monthlySalary,
    startedOn: values.startedOn,
  };
}

export async function createEmployee(
  project: ProjectId,
  values: EmployeeValues,
): Promise<{ ok: true; id: string } | Extract<SaveResult<keyof EmployeeValues>, { ok: false }>> {
  const id = newId();

  employees.push({ ...employeeFromValues(values), id, project, earned: 0 });
  return { ok: true, id };
}

export async function updateEmployee(
  id: string,
  values: EmployeeValues,
): Promise<SaveResult<keyof EmployeeValues>> {
  const index = employees.findIndex((employee) => employee.id === id);
  const current = employees[index];

  if (current === undefined) {
    return { ok: false, fieldErrors: {}, failed: true };
  }

  employees[index] = { ...current, ...employeeFromValues(values) };
  return { ok: true };
}

export async function deleteEmployee(id: string): Promise<{ ok: boolean }> {
  const index = employees.findIndex((employee) => employee.id === id);

  if (index === -1) {
    return { ok: false };
  }

  employees.splice(index, 1);
  return { ok: true };
}

export async function addWithdrawal(
  employee: string,
  values: WithdrawalValues,
  at: IsoTimestamp,
): Promise<SaveResult<keyof WithdrawalValues>> {
  withdrawals.push({
    id: newId(),
    employee,
    amount: values.amount,
    at,
    note: values.note.trim(),
    byName: "admin",
  });
  return { ok: true };
}

export async function updateWithdrawal(
  id: string,
  values: WithdrawalValues,
  at: IsoTimestamp,
): Promise<SaveResult<keyof WithdrawalValues>> {
  const index = withdrawals.findIndex((withdrawal) => withdrawal.id === id);
  const current = withdrawals[index];

  if (current === undefined) {
    return { ok: false, fieldErrors: {}, failed: true };
  }

  withdrawals[index] = { ...current, amount: values.amount, at, note: values.note.trim() };
  return { ok: true };
}

export async function deleteWithdrawal(id: string): Promise<{ ok: boolean }> {
  const index = withdrawals.findIndex((withdrawal) => withdrawal.id === id);

  if (index === -1) {
    return { ok: false };
  }

  withdrawals.splice(index, 1);
  return { ok: true };
}
