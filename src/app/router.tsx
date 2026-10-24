import { Outlet, redirect, useLoaderData } from "react-router";
import type { Params, RouteObject } from "react-router";
import { useLocale } from "use-intl";
import { LoginScreen } from "@/features/auth";
import {
  CustomerScreen,
  customerLoader,
  CustomersScreen,
  customersLoader,
} from "@/features/customers";
import {
  InventoryProjectScreen,
  inventoryProjectLoader,
  InventoryScreen,
  inventoryLoader,
  ResourceScreen,
  resourceLoader,
} from "@/features/inventory";
import {
  MachineDetailScreen,
  machineLoader,
  MillingProjectScreen,
  millingProjectLoader,
  MillingScreen,
  millingLoader,
} from "@/features/milling";
import {
  RefiningProjectScreen,
  refiningProjectLoader,
  RefiningScreen,
  refiningLoader,
} from "@/features/refining";
import {
  GrinderFormScreen,
  grinderFormLoader,
  LanguageScreen,
  ProfileScreen,
  profileLoader,
  ProjectFormScreen,
  projectFormLoader,
  projectLoader,
  ProjectSettingsScreen,
  ProjectsScreen,
  projectsLoader,
  SettingsHomeScreen,
  settingsHomeLoader,
} from "@/features/settings";
import {
  NewSettlementScreen,
  newSettlementLoader,
  SettlementProjectScreen,
  settlementProjectLoader,
  SettlementScreen,
  settlementLoader,
  SettlementsScreen,
  settlementsLoader,
} from "@/features/settlements";
import { AppShell, sectionHrefs } from "@/features/shell";
import {
  NewShipmentScreen,
  newShipmentLoader,
  ProjectStorageScreen,
  projectShipmentsLoader,
  projectStorageLoader,
  ShipmentHistoryScreen,
  ShipmentsScreen,
  shipmentLoader,
  ShipmentScreen,
  shipmentsLoader,
} from "@/features/shipments";
import { RolesScreen, rolesLoader, UsersScreen, usersLoader } from "@/features/users";
import { defaultLocale, isLocale } from "@/i18n/locales";
import type { Locale } from "@/i18n/locales";
import { localizedHref, Redirect, usePathname } from "@/i18n/navigation";
import { accessFromApi, canOpen, homeHref } from "@/lib/access";
import { AccessContext } from "@/lib/accessContext";
import { apiClient } from "@/lib/api/client";
import { isUnreachableStatus } from "@/lib/api/connection";
import { hasSession } from "@/lib/api/session";
import { displayName } from "@/lib/profile";
import { DASHBOARD_HREF, LOGIN_HREF } from "@/lib/routes";
import { LocaleLayout } from "./LocaleLayout";
import { LoadingPage, useNextPathname, FirstLoad, PageError } from "./PageStates";

function localeOf(params: Params): Locale {
  return isLocale(params.locale) ? params.locale : defaultLocale;
}

function redirectSignedIn({ params }: { params: Params }) {
  return hasSession(new Date()) ? redirect(localizedHref(localeOf(params), DASHBOARD_HREF)) : null;
}

async function loadSignedInUser({ params }: { params: Params }) {
  const toLogin = redirect(localizedHref(localeOf(params), LOGIN_HREF));
  if (!hasSession(new Date())) {
    return toLogin;
  }

  const { data, response } = await apiClient.GET("/api/v1/auth/me/");

  if (isUnreachableStatus(response.status)) {
    throw new Response(null, { status: response.status });
  }

  return data === undefined
    ? toLogin
    : {
        access: accessFromApi(data),
        userName: displayName(data),
        roleName: data.role?.name ?? "",
        projectScoped: data.role?.is_project_scoped ?? false,
      };
}

function SignedInLayout() {
  const { access, userName, roleName, projectScoped } = useLoaderData<typeof loadSignedInUser>();
  const locale = useLocale();
  const pathname = usePathname();
  const nextPathname = useNextPathname();

  if (!canOpen(access, pathname)) {
    return <Redirect locale={locale} href={homeHref(access)} />;
  }

  return (
    <AccessContext value={access}>
      <AppShell access={access} userName={userName} roleName={roleName}>
        {nextPathname === undefined ? (
          <Outlet />
        ) : (
          <LoadingPage pathname={nextPathname} projectScoped={projectScoped} />
        )}
      </AppShell>
    </AccessContext>
  );
}

const sectionRoutes: RouteObject[] = [
  { path: "customers", loader: customersLoader, element: <CustomersScreen /> },
  { path: "customers/:customer", loader: customerLoader, element: <CustomerScreen /> },
  { path: "settlements", loader: settlementsLoader, element: <SettlementsScreen /> },
  { path: "settlements/new", loader: newSettlementLoader, element: <NewSettlementScreen /> },
  {
    path: "settlements/projects/:project",
    loader: settlementProjectLoader,
    element: <SettlementProjectScreen />,
  },
  { path: "settlements/:settlement", loader: settlementLoader, element: <SettlementScreen /> },
  { path: "users", loader: usersLoader, element: <UsersScreen /> },
  { path: "users/roles", loader: rolesLoader, element: <RolesScreen /> },
  { path: "shipments", loader: shipmentsLoader, element: <ShipmentsScreen /> },
  { path: "shipments/new", loader: newShipmentLoader, element: <NewShipmentScreen /> },
  { path: "shipments/:shipment", loader: shipmentLoader, element: <ShipmentScreen /> },
  {
    path: "shipments/projects/:project",
    loader: projectStorageLoader,
    element: <ProjectStorageScreen />,
  },
  {
    path: "shipments/projects/:project/history",
    loader: projectShipmentsLoader,
    element: <ShipmentHistoryScreen />,
  },
  { path: "milling", loader: millingLoader, element: <MillingScreen /> },
  {
    path: "milling/projects/:project",
    loader: millingProjectLoader,
    element: <MillingProjectScreen />,
  },
  {
    path: "milling/projects/:project/machines/:machine",
    loader: machineLoader,
    element: <MachineDetailScreen />,
  },
  { path: "refining", loader: refiningLoader, element: <RefiningScreen /> },
  {
    path: "refining/projects/:project",
    loader: refiningProjectLoader,
    element: <RefiningProjectScreen />,
  },
  { path: "inventory", loader: inventoryLoader, element: <InventoryScreen /> },
  {
    path: "inventory/projects/:project",
    loader: inventoryProjectLoader,
    element: <InventoryProjectScreen />,
  },
  {
    path: "inventory/resources/:resource",
    loader: resourceLoader,
    element: <ResourceScreen />,
  },
  { path: "settings", loader: settingsHomeLoader, element: <SettingsHomeScreen /> },
  { path: "settings/profile", loader: profileLoader, element: <ProfileScreen /> },
  { path: "settings/language", element: <LanguageScreen /> },
  { path: "settings/projects", loader: projectsLoader, element: <ProjectsScreen /> },
  { path: "settings/projects/new", loader: projectFormLoader, element: <ProjectFormScreen /> },
  { path: "settings/projects/:project", loader: projectLoader, element: <ProjectSettingsScreen /> },
  {
    path: "settings/projects/:project/edit",
    loader: projectFormLoader,
    element: <ProjectFormScreen />,
  },
  {
    path: "settings/projects/:project/machines/new",
    loader: grinderFormLoader,
    element: <GrinderFormScreen />,
  },
  {
    path: "settings/projects/:project/machines/:machine",
    loader: grinderFormLoader,
    element: <GrinderFormScreen />,
  },
];

const emptySectionRoutes: RouteObject[] = sectionHrefs
  .map((href) => href.slice(1))
  .filter((path) => !sectionRoutes.some((route) => route.path === path))
  .map((path) => ({ path, element: null }));

export const routes: RouteObject[] = [
  { path: "/", element: <Redirect locale={defaultLocale} href={LOGIN_HREF} /> },
  {
    path: "/:locale",
    element: <LocaleLayout />,
    children: [
      {
        index: true,
        loader: ({ params }) => redirect(localizedHref(localeOf(params), LOGIN_HREF)),
      },
      { path: "login", loader: redirectSignedIn, element: <LoginScreen /> },
      {
        loader: loadSignedInUser,
        element: <SignedInLayout />,
        hydrateFallbackElement: <FirstLoad />,
        errorElement: <PageError />,
        children: [
          { errorElement: <PageError />, children: [...sectionRoutes, ...emptySectionRoutes] },
        ],
      },
    ],
  },
];
