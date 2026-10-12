import { decodeJwtPayload } from "./jwt";
import {
  DASHBOARD_HREF,
  isWithinHref,
  MILLING_HREF,
  REFINING_HREF,
  SETTINGS_HREF,
  SETTINGS_LANGUAGE_HREF,
  SETTINGS_PROFILE_HREF,
  SHIPMENTS_HREF,
} from "./routes";

export const userRoles = ["manager", "supervisor"] as const;

export type UserRole = (typeof userRoles)[number];

const supervisorHrefs: readonly string[] = [
  SHIPMENTS_HREF,
  MILLING_HREF,
  REFINING_HREF,
  SETTINGS_PROFILE_HREF,
  SETTINGS_LANGUAGE_HREF,
];

export function isUserRole(value: unknown): value is UserRole {
  return userRoles.some((role) => role === value);
}

export function roleOfToken(token: string): UserRole | undefined {
  const role = decodeJwtPayload(token)?.role;

  return isUserRole(role) ? role : undefined;
}

export function canOpen(role: UserRole, pathname: string): boolean {
  return (
    role === "manager" ||
    pathname === SETTINGS_HREF ||
    supervisorHrefs.some((href) => isWithinHref(pathname, href))
  );
}

export function homeHref(role: UserRole): string {
  return role === "manager" ? DASHBOARD_HREF : SHIPMENTS_HREF;
}
