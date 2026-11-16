import { useCallback } from "react";
import type { ComponentProps } from "react";
import {
  Navigate,
  Link as RouterLink,
  useLocation,
  useNavigate,
  useNavigation,
} from "react-router";
import { useLocale } from "use-intl";
import { isLocale } from "./locales";
import type { Locale } from "./locales";

export function localizedHref(locale: Locale, href: string): string {
  return `/${locale}${href}`;
}

type LinkProps = Omit<ComponentProps<typeof RouterLink>, "to" | "state"> & {
  href: string;
  locale?: Locale;
  opensDrawer?: boolean;
};

export function Link({ href, locale, opensDrawer = false, ...props }: LinkProps) {
  const current = useLocale();

  return (
    <RouterLink
      to={localizedHref(locale ?? current, href)}
      state={opensDrawer ? { opensDrawer: true } : undefined}
      {...props}
    />
  );
}

function isDrawerState(state: unknown): boolean {
  return (
    typeof state === "object" &&
    state !== null &&
    "opensDrawer" in state &&
    state.opensDrawer === true
  );
}

export function useLinkStatus(href: string): { pending: boolean; opensDrawer: boolean } {
  const locale = useLocale();
  const { pathname } = useLocation();
  const navigation = useNavigation();
  const target = localizedHref(locale, href);
  const next = navigation.location;

  return {
    pending: next !== undefined && `${next.pathname}${next.search}` === target,
    opensDrawer: target.split("?")[0] === pathname,
  };
}

export function useOpeningDrawer(): boolean {
  const navigation = useNavigation();

  return navigation.state === "loading" && isDrawerState(navigation.location.state);
}

export function usePathname(): string {
  return pathnameWithoutLocale(useLocation().pathname);
}

export function pathnameWithoutLocale(pathname: string): string {
  const [, segment] = pathname.split("/");

  return isLocale(segment) ? pathname.slice(segment.length + 1) || "/" : pathname;
}

export function useReplace(): (href: string) => void | Promise<void> {
  const navigate = useNavigate();
  const locale = useLocale();

  return useCallback(
    (href: string) => navigate(localizedHref(locale, href), { replace: true }),
    [navigate, locale],
  );
}

export function Redirect({ locale, href }: { locale: Locale; href: string }) {
  return <Navigate to={localizedHref(locale, href)} replace />;
}
