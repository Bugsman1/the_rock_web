import { apiClient, backendFieldErrors, saveFailed, saveOutcome, unwrap } from "@/lib/api/client";
import type { SaveResult } from "@/lib/api/client";
import { fetchAllPages, MAX_PAGE_SIZE, PAGE_SIZE, toPage } from "@/lib/api/pagination";
import type { Page } from "@/lib/api/pagination";
import { getRoles, userFromApi } from "@/lib/users";
import type { Role, User } from "@/lib/users";
import {
  roleDetailsFromApi,
  roleErrorsFromApi,
  roleToApi,
  userErrorsFromApi,
  userToApi,
} from "./users";
import type { RoleDetails, RoleValues, UserValues } from "./users";

const NUMERIC_ID = /^\d+$/;

type SaveUserResult = SaveResult<keyof UserValues>;

type SaveRoleResult = SaveResult<keyof RoleValues>;

export async function getUserPage(search: string, page: number): Promise<Page<User>> {
  const [roles, result] = await Promise.all([
    getRoles(),
    apiClient.GET("/api/v1/users/", {
      params: {
        query: {
          is_active: true,
          page,
          page_size: PAGE_SIZE,
          ...(search.trim() === "" ? {} : { search: search.trim() }),
        },
      },
    }),
  ]);

  return toPage(unwrap(result), page, (user) => userFromApi(user, roles));
}

export async function getUser(id: string): Promise<User | undefined> {
  if (!NUMERIC_ID.test(id)) {
    return undefined;
  }

  const [roles, result] = await Promise.all([
    getRoles(),
    apiClient.GET("/api/v1/users/{id}/", { params: { path: { id: Number(id) } } }),
  ]);

  return result.response.status === 404 ? undefined : userFromApi(unwrap(result), roles);
}

function isProjectScoped(roles: readonly Role[], roleId: string): boolean {
  return roles.some((role) => role.id === roleId && role.projectScoped);
}

export async function createUser(
  values: UserValues,
  roles: readonly Role[],
): Promise<SaveUserResult> {
  const { response, error } = await apiClient.POST("/api/v1/users/", {
    body: userToApi(values, isProjectScoped(roles, values.role)),
  });

  return saveOutcome(response, error, userErrorsFromApi);
}

export async function updateUser(
  id: string,
  values: UserValues,
  roles: readonly Role[],
): Promise<SaveUserResult> {
  if (!NUMERIC_ID.test(id)) {
    return saveFailed;
  }

  const { response, error } = await apiClient.PATCH("/api/v1/users/{id}/", {
    params: { path: { id: Number(id) } },
    body: userToApi(values, isProjectScoped(roles, values.role)),
  });

  return saveOutcome(response, error, userErrorsFromApi);
}

export async function getRoleDetails(): Promise<readonly RoleDetails[]> {
  const roles = await fetchAllPages(async (page) =>
    unwrap(
      await apiClient.GET("/api/v1/roles/", {
        params: { query: { page, page_size: MAX_PAGE_SIZE } },
      }),
    ),
  );

  return roles.map(roleDetailsFromApi);
}

export async function createRole(values: RoleValues): Promise<SaveRoleResult> {
  const { response, error } = await apiClient.POST("/api/v1/roles/", {
    body: roleToApi(values),
  });

  return saveOutcome(response, error, roleErrorsFromApi);
}

export async function updateRole(id: string, values: RoleValues): Promise<SaveRoleResult> {
  if (!NUMERIC_ID.test(id)) {
    return saveFailed;
  }

  const { response, error } = await apiClient.PATCH("/api/v1/roles/{id}/", {
    params: { path: { id: Number(id) } },
    body: roleToApi(values),
  });

  return saveOutcome(response, error, roleErrorsFromApi);
}

type DeleteRoleResult = { ok: true } | { ok: false; reason: string | undefined };

export async function deleteRole(id: string): Promise<DeleteRoleResult> {
  if (!NUMERIC_ID.test(id)) {
    return { ok: false, reason: undefined };
  }

  const { response, error } = await apiClient.DELETE("/api/v1/roles/{id}/", {
    params: { path: { id: Number(id) } },
  });

  return response.ok ? { ok: true } : { ok: false, reason: backendFieldErrors(error).role };
}
