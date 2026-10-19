import type { IconName } from "@/components/ui/Icon";
import { canOpen } from "@/lib/access";
import type { Access } from "@/lib/access";
import {
  CUSTOMERS_HREF,
  DASHBOARD_HREF,
  INVENTORY_HREF,
  MILLING_HREF,
  REFINING_HREF,
  SHIPMENTS_HREF,
  USERS_HREF,
} from "@/lib/routes";

type NavItemKey =
  | "dashboard"
  | "shipments"
  | "milling"
  | "refining"
  | "customers"
  | "settlement"
  | "accounting"
  | "treasury"
  | "employees"
  | "inventory"
  | "assets"
  | "reports"
  | "users"
  | "auditLog";

type NavGroupKey = "operations" | "accounts" | "resources" | "management";

type NavItem = {
  key: NavItemKey;
  href: string;
  icon: IconName;
};

type NavGroup = {
  key: NavGroupKey | null;
  items: readonly NavItem[];
};

const navGroups: readonly NavGroup[] = [
  {
    key: null,
    items: [{ key: "dashboard", href: DASHBOARD_HREF, icon: "layout-dashboard" }],
  },
  {
    key: "operations",
    items: [
      { key: "shipments", href: SHIPMENTS_HREF, icon: "truck-delivery" },
      { key: "milling", href: MILLING_HREF, icon: "mill" },
      { key: "refining", href: REFINING_HREF, icon: "flame" },
    ],
  },
  {
    key: "accounts",
    items: [
      { key: "customers", href: CUSTOMERS_HREF, icon: "users-four" },
      { key: "settlement", href: "/settlement", icon: "receipt" },
      { key: "accounting", href: "/accounting", icon: "calculator" },
      { key: "treasury", href: "/treasury", icon: "building-bank" },
    ],
  },
  {
    key: "resources",
    items: [
      { key: "employees", href: "/employees", icon: "id-badge" },
      { key: "inventory", href: INVENTORY_HREF, icon: "packages" },
      { key: "assets", href: "/assets", icon: "warehouse" },
    ],
  },
  {
    key: "management",
    items: [
      { key: "reports", href: "/reports", icon: "chart-bar" },
      { key: "users", href: USERS_HREF, icon: "shield-lock" },
      { key: "auditLog", href: "/audit-log", icon: "history" },
    ],
  },
];

export function navGroupsFor(access: Access): readonly NavGroup[] {
  return navGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => canOpen(access, item.href)) }))
    .filter((group) => group.items.length > 0);
}

export const sectionHrefs: readonly string[] = navGroups.flatMap((group) =>
  group.items.map((item) => item.href),
);
