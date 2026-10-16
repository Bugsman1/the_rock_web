export const LOGIN_HREF = "/login";

export const DASHBOARD_HREF = "/dashboard";

export const SHIPMENTS_HREF = "/shipments";

export const NEW_SHIPMENT_HREF = `${SHIPMENTS_HREF}/new`;

export const MILLING_HREF = "/milling";

export const REFINING_HREF = "/refining";

export const INVENTORY_HREF = "/inventory";

export const CUSTOMERS_HREF = "/customers";

export const USERS_HREF = "/users";

export const SETTINGS_HREF = "/settings";

export const SETTINGS_PROFILE_HREF = `${SETTINGS_HREF}/profile`;

export const SETTINGS_LANGUAGE_HREF = `${SETTINGS_HREF}/language`;

export const SETTINGS_PROJECTS_HREF = `${SETTINGS_HREF}/projects`;

export const NEW_PROJECT_HREF = `${SETTINGS_PROJECTS_HREF}/new`;

export function isWithinHref(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

type ListPageParams = {
  query?: string;
  page?: number;
  create?: boolean;
  edit?: string;
};

function listPageHref(base: string, { query, page, create, edit }: ListPageParams): string {
  const search = new URLSearchParams();

  if (query !== undefined && query.trim() !== "") search.set("q", query.trim());
  if (page !== undefined && page > 1) search.set("page", String(page));
  if (create === true) search.set("new", "1");
  if (edit !== undefined) search.set("edit", edit);

  const queryString = search.toString();

  return queryString === "" ? base : `${base}?${queryString}`;
}

export function customersHref(params: ListPageParams = {}): string {
  return listPageHref(CUSTOMERS_HREF, params);
}

export function usersHref(params: ListPageParams = {}): string {
  return listPageHref(USERS_HREF, params);
}

export const ROLES_HREF = `${USERS_HREF}/roles`;

export function rolesHref(
  drawer?: { create: true } | { edit: string } | { remove: string },
): string {
  if (drawer === undefined) return ROLES_HREF;
  if ("create" in drawer) return `${ROLES_HREF}?new=1`;
  if ("edit" in drawer) return `${ROLES_HREF}?${new URLSearchParams({ edit: drawer.edit })}`;

  return `${ROLES_HREF}?${new URLSearchParams({ delete: drawer.remove })}`;
}

export function settingsProjectHref(project: string): string {
  return `${SETTINGS_PROJECTS_HREF}/${project}`;
}

export function deleteProjectHref(project: string): string {
  return `${settingsProjectHref(project)}?delete=1`;
}

export function editProjectHref(project: string): string {
  return `${settingsProjectHref(project)}/edit`;
}

export function newGrinderHref(project: string): string {
  return `${settingsProjectHref(project)}/machines/new`;
}

export function grinderHref(project: string, grinder: string): string {
  return `${settingsProjectHref(project)}/machines/${grinder}`;
}

export function shipmentsProjectHref(project: string): string {
  return `${SHIPMENTS_HREF}/projects/${project}`;
}

export function startGrindingHref(project: string, shipmentNumber: string): string {
  return `${shipmentsProjectHref(project)}?${new URLSearchParams({ grind: shipmentNumber })}`;
}

export function shipmentsHistoryHref(project: string): string {
  return `${shipmentsProjectHref(project)}/history`;
}

export function millingSiteHref(site: string): string {
  return `${MILLING_HREF}?${new URLSearchParams({ site }).toString()}`;
}

export function millingProjectHref(project: string): string {
  return `${MILLING_HREF}/projects/${project}`;
}

export function millingMachineHref(project: string, machine: number): string {
  return `${millingProjectHref(project)}/machines/${machine}`;
}

type NewMillingOperationRequest = {
  shipmentNumber?: string;
  machine?: number;
};

export function newMillingOperationHref(
  project: string,
  request: NewMillingOperationRequest = {},
): string {
  const query = new URLSearchParams({ operation: "new" });

  if (request.shipmentNumber !== undefined) query.set("shipment", request.shipmentNumber);
  if (request.machine !== undefined) query.set("machine", String(request.machine));

  return `${millingProjectHref(project)}?${query.toString()}`;
}

export function startRefiningHref(grindingOperation: string): string {
  return `${REFINING_HREF}?${new URLSearchParams({ grinding: grindingOperation })}`;
}

export function inventoryProjectHref(project: string, newResource = false): string {
  const base = `${INVENTORY_HREF}/projects/${project}`;

  return newResource ? `${base}?new=resource` : base;
}

export const resourceActions = ["increase", "decrease"] as const;

export type ResourceAction = (typeof resourceActions)[number];

export function resourceHref(
  resource: string,
  { page = 1, action }: { page?: number; action?: ResourceAction } = {},
): string {
  const query = new URLSearchParams();

  if (page > 1) query.set("page", String(page));
  if (action !== undefined) query.set("action", action);

  const queryString = query.toString();
  const base = `${INVENTORY_HREF}/resources/${resource}`;

  return queryString === "" ? base : `${base}?${queryString}`;
}
