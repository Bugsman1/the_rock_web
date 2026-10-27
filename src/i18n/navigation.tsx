import { useCallback } from "react";
import type { ComponentProps } from "react";
import { Navigate, Link as RouterLink, useLocation, useNavigate } from "react-router";
import { useLocale } from "use-intl";
import { isLocale } from "./locales";
import type { Locale } from "./locales";

export function localizedHref(locale: Locale, href: string): string {
  return `/${locale}${href}`;
}

type LinkProps = Omit<ComponentProps<typeof RouterLink>, "to"> & {
  href: string;
  locale?: Locale;
};

export function Link({ href, locale, ...props }: LinkProps) {
  const current = useLocale();

  return <RouterLink to={localizedHref(locale ?? current, href)} {...props} />;
}

export function usePathname(): string {
  return pathnameWithoutLocale(useLocation().pathname);
}

export function pathnameWithoutLocale(pathname: string): string {
  const [, segment] = pathname.split("/");

  return isLocale(segment) ? pathname.slice(segment.length + 1) || "/" : pathname;
}

export function useReplace(): (href: string) => void {
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
