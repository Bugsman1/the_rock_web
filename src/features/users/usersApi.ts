import { apiClient, saveFailed, saveOutcome, unwrap } from "@/lib/api/client";
import type { SaveResult } from "@/lib/api/client";
import { PAGE_SIZE, toPage } from "@/lib/api/pagination";
import type { Page } from "@/lib/api/pagination";
import { getRoleIds, userFromApi } from "@/lib/users";
import type { User } from "@/lib/users";
import { userErrorsFromApi, userToApi } from "./users";
import type { UserValues } from "./users";

const NUMERIC_ID = /^\d+$/;

type SaveUserResult = SaveResult<keyof UserValues>;

export async function getUserPage(page: number): Promise<Page<User>> {
  const [roleIds, result] = await Promise.all([
    getRoleIds(),
    apiClient.GET("/api/v1/users/", {
      params: { query: { is_active: true, page, page_size: PAGE_SIZE } },
    }),
  ]);

  return toPage(unwrap(result), page, (user) => userFromApi(user, roleIds));
}

export async function getUser(id: string): Promise<User | undefined> {
  if (!NUMERIC_ID.test(id)) {
    return undefined;
  }

  const [roleIds, result] = await Promise.all([
    getRoleIds(),
    apiClient.GET("/api/v1/users/{id}/", { params: { path: { id: Number(id) } } }),
  ]);

  return result.response.status === 404 ? undefined : userFromApi(unwrap(result), roleIds);
}

export async function createUser(values: UserValues): Promise<SaveUserResult> {
  const roleId = (await getRoleIds()).get(values.role);

  if (roleId === undefined) {
    return saveFailed;
  }

  const { response, error } = await apiClient.POST("/api/v1/users/", {
    body: userToApi(values, roleId),
  });

  return saveOutcome(response, error, userErrorsFromApi);
}

export async function updateUser(id: string, values: UserValues): Promise<SaveUserResult> {
  const roleId = NUMERIC_ID.test(id) ? (await getRoleIds()).get(values.role) : undefined;

  if (roleId === undefined) {
    return saveFailed;
  }

  const { response, error } = await apiClient.PATCH("/api/v1/users/{id}/", {
    params: { path: { id: Number(id) } },
    body: userToApi(values, roleId),
  });

  return saveOutcome(response, error, userErrorsFromApi);
}
