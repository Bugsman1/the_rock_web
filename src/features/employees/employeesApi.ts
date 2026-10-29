import { z } from "zod";
import {
  apiClient,
  backendFieldErrors,
  idempotent,
  saveFailed,
  saveOutcome,
  unwrap,
} from "@/lib/api/client";
import type { SaveResult } from "@/lib/api/client";
import { fetchAllPages, MAX_PAGE_SIZE } from "@/lib/api/pagination";
import type { IsoTimestamp } from "@/lib/format";
import { isRecordId } from "@/lib/projects";
import type { ProjectId } from "@/lib/projects";
import {
  employeeErrorsFromApi,
  employeeFromApi,
  employeeToApi,
  newEmployeeToApi,
  raiseErrorsFromApi,
  raiseToApi,
  withdrawalErrorsFromApi,
  withdrawalFromApi,
  withdrawalToApi,
} from "./employees";
import type {
  Employee,
  EmployeeValues,
  RaiseValues,
  Withdrawal,
  WithdrawalValues,
} from "./employees";

export type DeleteResult = { ok: true } | { ok: false; reason: string | undefined };

const refusalSchema = z.array(z.string());

function deleteResult(response: Response, error: unknown): DeleteResult {
  if (response.ok) {
    return { ok: true };
  }

  const refusal = refusalSchema.safeParse(error);

  return {
    ok: false,
    reason: refusal.success ? refusal.data[0] : backendFieldErrors(error).detail,
  };
}

export async function getEmployees(project?: ProjectId): Promise<readonly Employee[]> {
  const employees = await fetchAllPages(async (page) =>
    unwrap(
      await apiClient.GET("/api/v1/employees/", {
        params: {
          query: {
            page,
            page_size: MAX_PAGE_SIZE,
            ...(project === undefined ? {} : { project: Number(project) }),
          },
        },
      }),
    ),
  );

  return employees.map(employeeFromApi);
}

export async function getEmployee(id: string): Promise<Employee | undefined> {
  if (!isRecordId(id)) {
    return undefined;
  }

  const result = await apiClient.GET("/api/v1/employees/{id}/", {
    params: { path: { id: Number(id) } },
  });

  return result.response.status === 404 ? undefined : employeeFromApi(unwrap(result));
}

export async function getWithdrawals(employee: string): Promise<readonly Withdrawal[]> {
  const withdrawals = await fetchAllPages(async (page) =>
    unwrap(
      await apiClient.GET("/api/v1/employee-withdrawals/", {
        params: { query: { employee: Number(employee), page, page_size: MAX_PAGE_SIZE } },
      }),
    ),
  );

  return withdrawals.map(withdrawalFromApi);
}

export async function createEmployee(
  project: ProjectId,
  values: EmployeeValues,
  startedAt: IsoTimestamp,
  key: string,
): Promise<SaveResult<keyof EmployeeValues>> {
  const { response, error } = await apiClient.POST("/api/v1/employees/", {
    params: idempotent(key),
    body: newEmployeeToApi(project, values, startedAt),
  });

  return saveOutcome(response, error, employeeErrorsFromApi);
}

export async function updateEmployee(
  id: string,
  values: EmployeeValues,
  startedAt: IsoTimestamp,
): Promise<SaveResult<keyof EmployeeValues>> {
  if (!isRecordId(id)) {
    return saveFailed;
  }

  const { response, error } = await apiClient.PATCH("/api/v1/employees/{id}/", {
    params: { path: { id: Number(id) } },
    body: employeeToApi(values, startedAt),
  });

  return saveOutcome(response, error, employeeErrorsFromApi);
}

export async function deleteEmployee(id: string): Promise<DeleteResult> {
  const { response, error } = await apiClient.DELETE("/api/v1/employees/{id}/", {
    params: { path: { id: Number(id) } },
  });

  return deleteResult(response, error);
}

export async function addRaise(
  employee: string,
  values: RaiseValues,
  key: string,
): Promise<SaveResult<keyof RaiseValues>> {
  const { response, error } = await apiClient.POST("/api/v1/employee-salaries/", {
    params: idempotent(key),
    body: raiseToApi(employee, values),
  });

  return saveOutcome(response, error, raiseErrorsFromApi);
}

export async function addWithdrawal(
  employee: string,
  values: WithdrawalValues,
  at: IsoTimestamp,
  key: string,
): Promise<SaveResult<keyof WithdrawalValues>> {
  const { response, error } = await apiClient.POST("/api/v1/employee-withdrawals/", {
    params: idempotent(key),
    body: { ...withdrawalToApi(values, at), employee: Number(employee) },
  });

  return saveOutcome(response, error, withdrawalErrorsFromApi);
}

export async function updateWithdrawal(
  id: string,
  values: WithdrawalValues,
  at: IsoTimestamp,
): Promise<SaveResult<keyof WithdrawalValues>> {
  const { response, error } = await apiClient.PATCH("/api/v1/employee-withdrawals/{id}/", {
    params: { path: { id: Number(id) } },
    body: withdrawalToApi(values, at),
  });

  return saveOutcome(response, error, withdrawalErrorsFromApi);
}

export async function deleteWithdrawal(id: string): Promise<DeleteResult> {
  const { response, error } = await apiClient.DELETE("/api/v1/employee-withdrawals/{id}/", {
    params: { path: { id: Number(id) } },
  });

  return deleteResult(response, error);
}
