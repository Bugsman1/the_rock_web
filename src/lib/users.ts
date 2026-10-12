import { apiClient, unwrap } from "./api/client";
import type { ApiSchema } from "./api/client";
import { fetchAllPages, MAX_PAGE_SIZE } from "./api/pagination";
import { displayName } from "./profile";
import type { ProjectId } from "./projects";

export type Role = {
  id: string;
  name: string;
  projectScoped: boolean;
};

export type User = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role | undefined;
  project: ProjectId | undefined;
};

export type Operator = {
  id: string;
  name: string;
};

export const builtInRoleNames = ["manager", "supervisor"] as const;

type BuiltInRoleName = (typeof builtInRoleNames)[number];

function isBuiltInRoleName(name: string): name is BuiltInRoleName {
  return builtInRoleNames.some((builtIn) => builtIn === name);
}

export function roleLabel(name: string, builtInLabel: (name: BuiltInRoleName) => string): string {
  return isBuiltInRoleName(name) ? builtInLabel(name) : name;
}

export function roleFromApi(role: ApiSchema<"Role">): Role {
  return {
    id: String(role.id),
    name: role.name,
    projectScoped: role.is_project_scoped ?? false,
  };
}

export function userFromApi(user: ApiSchema<"User">, roles: readonly Role[]): User {
  return {
    id: String(user.id),
    name: displayName({ full_name: user.full_name ?? "", email: user.email }),
    email: user.email,
    phone: user.phone ?? "",
    role: roles.find((role) => role.id === String(user.role)),
    project: user.project === null || user.project === undefined ? undefined : String(user.project),
  };
}

export async function getRoles(): Promise<readonly Role[]> {
  const roles = await fetchAllPages(async (page) =>
    unwrap(
      await apiClient.GET("/api/v1/roles/", {
        params: { query: { page, page_size: MAX_PAGE_SIZE } },
      }),
    ),
  );

  return roles.map(roleFromApi);
}

type OperatorModule = "grinding" | "refining";

export async function getOperators(
  project: ProjectId,
  module: OperatorModule,
): Promise<readonly Operator[]> {
  const operators = unwrap(
    await apiClient.GET("/api/v1/operators/", {
      params: { query: { module, project: Number(project) } },
    }),
  );

  return operators.map((operator) => ({ id: String(operator.id), name: operator.name }));
}
