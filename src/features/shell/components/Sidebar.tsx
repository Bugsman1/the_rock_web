import { useState } from "react";
import { useTranslations } from "use-intl";
import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/Icon";
import { Link, usePathname, useReplace } from "@/i18n/navigation";
import { canOpen } from "@/lib/access";
import type { Access } from "@/lib/access";
import { clearSession } from "@/lib/api/session";
import { cn } from "@/lib/cn";
import { isWithinHref, LOGIN_HREF, SETTINGS_HREF } from "@/lib/routes";
import { navGroupsFor } from "../navigation";

type SidebarItemProps = {
  href: string;
  icon: IconName;
  label: string;
  active: boolean;
  current: boolean;
  collapsed: boolean;
  onNavigate: () => void;
};

export function useLogOut(): () => void {
  const replace = useReplace();

  return () => {
    clearSession();
    replace(LOGIN_HREF);
  };
}

function SidebarItem({
  href,
  icon,
  label,
  active,
  current,
  collapsed,
  onNavigate,
}: SidebarItemProps) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "relative mx-2 flex min-h-9 items-center gap-2.5 rounded-lg text-[14px] font-semibold",
        collapsed ? "justify-center px-0" : "px-2",
        active ? "bg-brand-50 text-brand-700" : "text-ink hover:bg-surface-hover",
      )}
    >
      {active ? (
        <span aria-hidden className="bg-brand-700 absolute inset-y-2 start-0 w-1 rounded-e-full" />
      ) : null}

      <span
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-lg",
          active && "bg-brand-100",
        )}
      >
        <Icon name={icon} />
      </span>

      {collapsed ? (
        <span className="sr-only">{label}</span>
      ) : (
        <span className="truncate">{label}</span>
      )}
    </Link>
  );
}

type SidebarProps = {
  access: Access;
  collapsed: boolean;
  mobileOpen: boolean;
  onNavigate: () => void;
};

export function Sidebar({
  access,
  collapsed: desktopCollapsed,
  mobileOpen,
  onNavigate,
}: SidebarProps) {
  const t = useTranslations("shell");
  const nav = useTranslations("shell.nav");
  const groups = useTranslations("shell.navGroups");
  const pathname = usePathname();
  const logOut = useLogOut();
  const [navigation, setNavigation] = useState<{ from: string; to: string } | null>(null);

  const collapsed = desktopCollapsed && !mobileOpen;
  const highlighted =
    navigation !== null && navigation.from === pathname ? navigation.to : pathname;

  function itemState(href: string) {
    return {
      active: isWithinHref(highlighted, href),
      current: isWithinHref(pathname, href),
      onNavigate: () => {
        setNavigation({ from: pathname, to: href });
        onNavigate();
      },
    };
  }

  return (
    <aside
      className={cn(
        "border-line bg-surface shrink-0 flex-col border-e-[1.5px]",
        mobileOpen
          ? "fixed start-0 top-16 bottom-0 z-40 flex w-72 md:static md:z-auto"
          : "hidden md:flex",
        collapsed ? "md:w-16" : "md:w-72",
      )}
    >
      <nav aria-label={t("navigation")} className="scrollbar-on-hover flex-1 overflow-y-auto py-3">
        <ul className="flex flex-col gap-2.5">
          {navGroupsFor(access).map((group) => (
            <li key={group.key ?? "primary"}>
              {group.key === null || collapsed ? null : (
                <p className="text-ink-muted px-4 pt-0.5 pb-1 text-[12px] font-bold tracking-wide">
                  {groups(group.key)}
                </p>
              )}

              <ul className="flex flex-col">
                {group.items.map((item) => (
                  <li key={item.key}>
                    <SidebarItem
                      href={item.href}
                      icon={item.icon}
                      label={nav(item.key)}
                      collapsed={collapsed}
                      {...itemState(item.href)}
                    />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-line-subtle flex flex-col border-t-[1.5px] py-2">
        {canOpen(access, SETTINGS_HREF) ? (
          <SidebarItem
            href={SETTINGS_HREF}
            icon="settings"
            label={t("settings")}
            collapsed={collapsed}
            {...itemState(SETTINGS_HREF)}
          />
        ) : null}

        <div className="mx-2">
          <button
            type="button"
            onClick={logOut}
            className={cn(
              "text-danger-700 hover:bg-danger-50 flex min-h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg text-[14px] font-semibold",
              collapsed ? "justify-center px-0" : "px-2",
            )}
          >
            <span className="inline-flex size-8 shrink-0 items-center justify-center">
              <Icon name="logout" />
            </span>
            {collapsed ? <span className="sr-only">{t("logout")}</span> : t("logout")}
          </button>
        </div>
      </div>
    </aside>
  );
}
