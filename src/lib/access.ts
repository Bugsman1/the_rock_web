import type { ApiSchema } from "./api/client";
import {
  AUDIT_LOG_HREF,
  CUSTOMERS_HREF,
  DASHBOARD_HREF,
  EMPLOYEES_HREF,
  INVENTORY_HREF,
  isWithinHref,
  MILLING_HREF,
  REFINING_HREF,
  SETTINGS_HREF,
  SETTINGS_LANGUAGE_HREF,
  SETTINGS_PROFILE_HREF,
  SETTINGS_PROJECTS_HREF,
  SETTLEMENTS_HREF,
  SHIPMENTS_HREF,
  SUPPLIERS_HREF,
  USERS_HREF,
} from "./routes";

export const modules = [
  "shipments",
  "grinding",
  "refining",
  "inventory",
  "customers",
  "debts",
  "settlements",
  "employees",
  "suppliers",
  "accounts",
  "locations",
  "audit",
] as const;

export type Module = (typeof modules)[number];

export const rights = ["view", "add", "edit", "delete"] as const;

export type Right = (typeof rights)[number];

export function rightsOfModule(module: Module): readonly Right[] {
  return module === "audit" ? ["view"] : rights;
}

type ModuleRights = Record<Right, boolean>;

export type Rights = Record<Module, ModuleRights>;

const noRights: ModuleRights = { view: false, add: false, edit: false, delete: false };

export function emptyRights(): Rights {
  return {
    shipments: noRights,
    grinding: noRights,
    refining: noRights,
    inventory: noRights,
    customers: noRights,
    debts: noRights,
    settlements: noRights,
    employees: noRights,
    suppliers: noRights,
    accounts: noRights,
    locations: noRights,
    audit: noRights,
  };
}

export function rightsFromApi(permissions: readonly ApiSchema<"RoleModulePermission">[]): Rights {
  const granted = emptyRights();

  for (const permission of permissions) {
    granted[permission.module] = {
      view: permission.can_view ?? false,
      add: permission.can_add ?? false,
      edit: permission.can_edit ?? false,
      delete: permission.can_delete ?? false,
    };
  }

  return granted;
}

export type Access = {
  userId: string;
  superuser: boolean;
  rights: Rights;
};

export const noAccess: Access = { userId: "", superuser: false, rights: emptyRights() };

export function accessFromApi(me: ApiSchema<"Me">): Access {
  const superuser = me.is_superuser ?? false;
  const granted = rightsFromApi(me.role?.permissions ?? []);
  const projectScoped = !superuser && (me.role?.is_project_scoped ?? false);

  return {
    userId: String(me.id),
    superuser,
    rights: projectScoped ? { ...granted, audit: noRights } : granted,
  };
}

export function can(access: Access, module: Module, right: Right): boolean {
  return access.superuser || access.rights[module][right];
}

const sectionModules: readonly (readonly [string, Module])[] = [
  [SHIPMENTS_HREF, "shipments"],
  [MILLING_HREF, "grinding"],
  [REFINING_HREF, "refining"],
  [INVENTORY_HREF, "inventory"],
  [CUSTOMERS_HREF, "customers"],
  [SETTLEMENTS_HREF, "settlements"],
  [EMPLOYEES_HREF, "employees"],
  [SUPPLIERS_HREF, "suppliers"],
  [USERS_HREF, "accounts"],
  [SETTINGS_PROJECTS_HREF, "locations"],
  [AUDIT_LOG_HREF, "audit"],
];

const openToEveryone: readonly string[] = [SETTINGS_PROFILE_HREF, SETTINGS_LANGUAGE_HREF];

const formPages: readonly (readonly [RegExp, Module, Right])[] = [
  [/^\/shipments\/new$/, "shipments", "add"],
  [/^\/settlements\/new$/, "settlements", "add"],
  [/^\/customers\/\d+$/, "debts", "view"],
  [/^\/settings\/projects\/new$/, "locations", "add"],
  [/^\/settings\/projects\/\d+\/edit$/, "locations", "edit"],
  [/^\/settings\/projects\/\d+\/machines\/new$/, "locations", "add"],
  [/^\/settings\/projects\/\d+\/machines\/\d+$/, "locations", "edit"],
];

function hasFullAccess(access: Access): boolean {
  return modules.every((module) => can(access, module, "view"));
}

export function canOpen(access: Access, pathname: string): boolean {
  if (
    access.superuser ||
    pathname === SETTINGS_HREF ||
    openToEveryone.some((href) => isWithinHref(pathname, href))
  ) {
    return true;
  }

  const form = formPages.find(([pattern]) => pattern.test(pathname));
  if (form !== undefined) {
    return can(access, form[1], form[2]);
  }

  const section = sectionModules.find(([href]) => isWithinHref(pathname, href));

  return section === undefined ? hasFullAccess(access) : can(access, section[1], "view");
}

const homeCandidates: readonly string[] = [
  DASHBOARD_HREF,
  SHIPMENTS_HREF,
  MILLING_HREF,
  REFINING_HREF,
  INVENTORY_HREF,
  CUSTOMERS_HREF,
  USERS_HREF,
];

export function homeHref(access: Access): string {
  return homeCandidates.find((href) => canOpen(access, href)) ?? SETTINGS_HREF;
}
