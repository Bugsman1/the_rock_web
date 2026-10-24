import { useEffect } from "react";
import {
  isRouteErrorResponse,
  useLocation,
  useNavigation,
  useRevalidator,
  useRouteError,
} from "react-router";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Icon } from "@/components/ui/Icon";
import { PageSkeleton } from "@/components/ui/LoadingDots";
import { useDismissToast } from "@/components/ui/Toast";
import type { SkeletonShape } from "@/components/ui/LoadingDots";
import { errorKind } from "@/lib/api/client";
import { hasSession } from "@/lib/api/session";
import { DASHBOARD_HREF, LOGIN_HREF } from "@/lib/routes";

const pageShapes: readonly (readonly [RegExp, SkeletonShape])[] = [
  [/^\/(shipments|settlements)\/new$/, "form"],
  [/^\/settings\/projects\/(new|\d+\/edit|\d+\/machines\/(new|\d+))$/, "form"],
  [/^\/(customers|users|users\/roles)$/, "table"],
  [/^\/settlements\/projects\/\d+$/, "table"],
  [/^\/refining\/projects\/\d+$/, "table"],
  [/^\/inventory\/(projects|resources)\/\d+$/, "table"],
  [/^\/(shipments|milling)\/projects\/\d+(\/history)?$/, "table"],
  [/^\/settings\/(profile|projects\/\d+)$/, "detail"],
  [/^\/milling\/projects\/\d+\/machines\/\d+$/, "detail"],
  [/^\/(shipments|settlements)\/\d+$/, "detail"],
  [/^\/customers\/\d+$/, "table"],
];

const singleProjectSections = /^\/(shipments|settlements|milling|refining)$/;

export function skeletonShapeFor(pathname: string, projectScoped = false): SkeletonShape {
  const [, , ...rest] = pathname.split("/");
  const page = `/${rest.join("/")}`;

  if (projectScoped && singleProjectSections.test(page)) {
    return "table";
  }

  return pageShapes.find(([pattern]) => pattern.test(page))?.[1] ?? "cards";
}

export function LoadingPage({
  pathname,
  projectScoped = false,
}: {
  pathname: string;
  projectScoped?: boolean;
}) {
  const common = useTranslations("common");

  return (
    <PageSkeleton label={common("loading")} shape={skeletonShapeFor(pathname, projectScoped)} />
  );
}

export function useNextPathname(): string | undefined {
  const navigation = useNavigation();
  const { pathname } = useLocation();

  return navigation.state === "loading" && navigation.location.pathname !== pathname
    ? navigation.location.pathname
    : undefined;
}

export function FirstLoad() {
  const { pathname } = useLocation();

  return (
    <div className="p-4 md:p-6">
      <LoadingPage pathname={pathname} />
    </div>
  );
}

const errorIcons = {
  notFound: "search",
  forbidden: "shield-lock",
  connection: "wifi-off",
  failed: "refresh",
} as const;

export function PageError() {
  const error = useRouteError();
  const t = useTranslations("errors");
  const revalidator = useRevalidator();
  const signedIn = hasSession(new Date());
  const status = isRouteErrorResponse(error) ? error.status : undefined;
  const kind = errorKind(status);
  const dismissToast = useDismissToast();

  useEffect(() => dismissToast(), [dismissToast]);

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
        {status === undefined || kind === "connection" ? null : (
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
          <ButtonLink href={signedIn ? DASHBOARD_HREF : LOGIN_HREF} variant="secondary">
            <Icon name="arrow-left" />
            {t("home")}
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
