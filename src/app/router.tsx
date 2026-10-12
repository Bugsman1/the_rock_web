import {
  isRouteErrorResponse,
  Outlet,
  redirect,
  useLoaderData,
  useLocation,
  useNavigation,
  useRevalidator,
  useRouteError,
} from "react-router";
import type { Params, RouteObject } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Icon } from "@/components/ui/Icon";
import { PageSkeleton } from "@/components/ui/LoadingDots";
import type { SkeletonShape } from "@/components/ui/LoadingDots";
import { LoginScreen } from "@/features/auth";
import { CustomersScreen, customersLoader } from "@/features/customers";
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
import { RefiningScreen, refiningLoader } from "@/features/refining";
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
import { AppShell, sectionHrefs } from "@/features/shell";
import {
  NewShipmentScreen,
  newShipmentLoader,
  ProjectStorageScreen,
  projectShipmentsLoader,
  projectStorageLoader,
  ShipmentHistoryScreen,
  ShipmentsScreen,
  shipmentsLoader,
} from "@/features/shipments";
import { UsersScreen, usersLoader } from "@/features/users";
import { defaultLocale, isLocale } from "@/i18n/locales";
import type { Locale } from "@/i18n/locales";
import { localizedHref, Redirect, usePathname } from "@/i18n/navigation";
import { canOpen, homeHref } from "@/lib/access";
import { apiClient, errorKind } from "@/lib/api/client";
import { sessionRole } from "@/lib/api/session";
import { displayName } from "@/lib/profile";
import { LOGIN_HREF } from "@/lib/routes";
import { LocaleLayout } from "./LocaleLayout";

function localeOf(params: Params): Locale {
  return isLocale(params.locale) ? params.locale : defaultLocale;
}

function redirectSignedIn({ params }: { params: Params }) {
  const role = sessionRole(new Date());

  return role === undefined ? null : redirect(localizedHref(localeOf(params), homeHref(role)));
}

async function loadSignedInUser({ params }: { params: Params }) {
  const toLogin = redirect(localizedHref(localeOf(params), LOGIN_HREF));
  const role = sessionRole(new Date());

  if (role === undefined) {
    return toLogin;
  }

  const { data } = await apiClient.GET("/api/v1/auth/me/");

  return data === undefined ? toLogin : { role, userName: displayName(data) };
}

const pageShapes: readonly (readonly [RegExp, SkeletonShape])[] = [
  [/^\/shipments\/new$/, "form"],
  [/^\/settings\/projects\/(new|\d+\/edit|\d+\/machines\/(new|\d+))$/, "form"],
  [/^\/(customers|users|refining)$/, "table"],
  [/^\/inventory\/(projects|resources)\/\d+$/, "table"],
  [/^\/(shipments|milling)\/projects\/\d+(\/history)?$/, "table"],
  [/^\/settings\/(profile|projects\/\d+)$/, "detail"],
  [/^\/milling\/projects\/\d+\/machines\/\d+$/, "detail"],
];

export function skeletonShapeFor(pathname: string): SkeletonShape {
  const [, , ...rest] = pathname.split("/");
  const page = `/${rest.join("/")}`;

  return pageShapes.find(([pattern]) => pattern.test(page))?.[1] ?? "cards";
}

function LoadingPage({ pathname }: { pathname: string }) {
  const common = useTranslations("common");

  return <PageSkeleton label={common("loading")} shape={skeletonShapeFor(pathname)} />;
}

function useNextPathname(): string | undefined {
  const navigation = useNavigation();
  const { pathname } = useLocation();

  return navigation.state === "loading" && navigation.location.pathname !== pathname
    ? navigation.location.pathname
    : undefined;
}

function FirstLoad() {
  const { pathname } = useLocation();

  return (
    <div className="p-4 md:p-6">
      <LoadingPage pathname={pathname} />
    </div>
  );
}

const errorIcons = { notFound: "search", forbidden: "shield-lock", failed: "refresh" } as const;

function PageError() {
  const error = useRouteError();
  const t = useTranslations("errors");
  const revalidator = useRevalidator();
  const role = sessionRole(new Date());
  const status = isRouteErrorResponse(error) ? error.status : undefined;
  const kind = errorKind(status);

  return (
    <div className="flex justify-center px-4 py-12">
      <section
        role="alert"
        className="rounded-card border-line bg-surface shadow-subtle flex w-full max-w-lg flex-col items-center gap-4 border-[1.5px] p-8 text-center"
      >
        <span className="bg-brand-50 text-brand-700 inline-flex size-16 items-center justify-center rounded-full">
          <Icon name={errorIcons[kind]} className="size-8" />
        </span>
        <h1 className="text-ink text-[22px] font-bold">{t(`${kind}.title`)}</h1>
        <p className="text-ink-muted text-[15px] font-semibold">{t(`${kind}.description`)}</p>
        {status === undefined ? null : (
          <p className="text-ink-faint text-[13px] font-semibold">
            {t("status", { status: String(status) })}
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            variant="primary"
            width="auto"
            disabled={revalidator.state === "loading"}
            onClick={() => void revalidator.revalidate()}
          >
            <Icon name="refresh" />
            {t("retry")}
          </Button>
          <ButtonLink href={role === undefined ? LOGIN_HREF : homeHref(role)} variant="secondary">
            <Icon name="arrow-left" />
            {t("home")}
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}

function SignedInLayout() {
  const { role, userName } = useLoaderData<typeof loadSignedInUser>();
  const locale = useLocale();
  const pathname = usePathname();
  const nextPathname = useNextPathname();

  if (!canOpen(role, pathname)) {
    return <Redirect locale={locale} href={homeHref(role)} />;
  }

  return (
    <AppShell role={role} userName={userName}>
      {nextPathname === undefined ? <Outlet /> : <LoadingPage pathname={nextPathname} />}
    </AppShell>
  );
}

const sectionRoutes: RouteObject[] = [
  { path: "customers", loader: customersLoader, element: <CustomersScreen /> },
  { path: "users", loader: usersLoader, element: <UsersScreen /> },
  { path: "shipments", loader: shipmentsLoader, element: <ShipmentsScreen /> },
  { path: "shipments/new", loader: newShipmentLoader, element: <NewShipmentScreen /> },
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
