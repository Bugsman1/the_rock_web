import { isUserRole } from "./access";
import type { UserRole } from "./access";
import { apiClient, unwrap } from "./api/client";
import type { ApiSchema } from "./api/client";
import { fetchAllPages, MAX_PAGE_SIZE } from "./api/pagination";
import { displayName } from "./profile";
import type { ProjectId } from "./projects";

export type User = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole | undefined;
  project: ProjectId | undefined;
};

export type Operator = {
  id: string;
  name: string;
};

type RoleIds = ReadonlyMap<UserRole, number>;

export function roleIdsFromApi(roles: readonly ApiSchema<"Role">[]): RoleIds {
  return new Map(
    roles.flatMap((role) => (isUserRole(role.name) ? [[role.name, role.id] as const] : [])),
  );
}

function roleWithId(roleIds: RoleIds, id: number | null | undefined): UserRole | undefined {
  return [...roleIds].find(([, roleId]) => roleId === id)?.[0];
}

export function userFromApi(user: ApiSchema<"User">, roleIds: RoleIds): User {
  return {
    id: String(user.id),
    name: displayName({ full_name: user.full_name ?? "", email: user.email }),
    email: user.email,
    phone: user.phone ?? "",
    role: roleWithId(roleIds, user.role),
    project: user.project === null || user.project === undefined ? undefined : String(user.project),
  };
}

export async function getRoleIds(): Promise<RoleIds> {
  const result = await apiClient.GET("/api/v1/roles/", {
    params: { query: { page_size: MAX_PAGE_SIZE } },
  });

  return roleIdsFromApi(unwrap(result).results);
}

export async function getActiveUsers(): Promise<readonly User[]> {
  const [roleIds, users] = await Promise.all([
    getRoleIds(),
    fetchAllPages(async (page) =>
      unwrap(
        await apiClient.GET("/api/v1/users/", {
          params: { query: { is_active: true, page, page_size: MAX_PAGE_SIZE } },
        }),
      ),
    ),
  ]);

  return users.map((user) => userFromApi(user, roleIds));
}

export function operatorsOfProject(
  users: readonly User[],
  project: ProjectId,
): readonly Operator[] {
  return users
    .filter(
      (user) => user.role === "manager" || (user.role === "supervisor" && user.project === project),
    )
    .map((user) => ({ id: user.id, name: user.name }));
}

export async function getOperators(project: ProjectId): Promise<readonly Operator[]> {
  return operatorsOfProject(await getActiveUsers(), project);
}
