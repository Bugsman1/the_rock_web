import { useCallback, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import logoUrl from "@/icons/logo_soukhour.svg";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useDismiss } from "@/components/ui/useDismiss";
import { Link } from "@/i18n/navigation";
import { SETTINGS_PROFILE_HREF } from "@/lib/routes";
import { roleLabel } from "@/lib/users";
import { useLogOut } from "./Sidebar";

type UserBadgeProps = {
  name: string;
  role: string;
};

const USER_MENU_ID = "user-menu";

const userMenuItemClasses =
  "flex min-h-11 w-full cursor-pointer items-center gap-2.5 px-3 text-[14px] font-semibold";

function UserMenu({ name, role }: UserBadgeProps) {
  const t = useTranslations("shell");
  const logOut = useLogOut();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useDismiss(open, container, close);

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={USER_MENU_ID}
        aria-label={t("userMenu", { name })}
        onClick={() => setOpen((previous) => !previous)}
        className="rounded-field text-ink hover:bg-surface-hover inline-flex h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center gap-2 sm:px-2"
      >
        <Icon name="user" />
        <span
          aria-hidden
          dir="auto"
          className="hidden max-w-48 truncate text-[14px] font-semibold sm:inline"
        >
          {name}
        </span>
      </button>

      {open ? (
        <div
          id={USER_MENU_ID}
          className="rounded-field border-line bg-surface shadow-card absolute end-0 top-full z-10 mt-2 w-max min-w-56 overflow-hidden border-[1.5px]"
        >
          <div className="border-line-subtle flex flex-col border-b px-3 py-2.5">
            <span className="text-ink truncate text-[14px] font-bold">{name}</span>
            <span className="text-ink-muted truncate text-[12px] font-semibold">{role}</span>
          </div>
          <ul className="divide-line-subtle divide-y">
            <li>
              <Link
                href={SETTINGS_PROFILE_HREF}
                onClick={close}
                className={`${userMenuItemClasses} text-ink hover:bg-surface-hover`}
              >
                <Icon name="user" className="h-5 w-5" />
                {t("profile")}
              </Link>
            </li>
            <li>
              <button
                type="button"
                onClick={logOut}
                className={`${userMenuItemClasses} text-danger-700 hover:bg-danger-50`}
              >
                <Icon name="logout" className="h-5 w-5" />
                {t("logout")}
              </button>
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}

type TopBarProps = {
  roleName: string;
  userName: string;
  sidebarCollapsed: boolean;
  mobileMenuOpen: boolean;
  onToggleSidebar: () => void;
  onToggleMobileMenu: () => void;
};

export function TopBar({
  roleName,
  userName,
  sidebarCollapsed,
  mobileMenuOpen,
  onToggleSidebar,
  onToggleMobileMenu,
}: TopBarProps) {
  const t = useTranslations("shell");
  const common = useTranslations("common");
  const roles = useTranslations("roles");

  return (
    <header className="border-line bg-surface flex h-16 shrink-0 items-center gap-2 border-b-[1.5px] px-4 md:gap-4 md:px-6">
      <div className="flex flex-1 items-center gap-2">
        <img src={logoUrl} alt={common("companyName")} className="size-10 shrink-0" />
        <span
          aria-hidden
          className="text-ink hidden text-[16px] font-bold whitespace-nowrap lg:inline"
        >
          {common("companyName")}
        </span>
        <span className="md:hidden">
          <IconButton
            icon="menu"
            label={t("toggleSidebar")}
            aria-expanded={mobileMenuOpen}
            onClick={onToggleMobileMenu}
          />
        </span>
        <span className="hidden md:inline-flex">
          <IconButton
            icon="menu"
            label={t("toggleSidebar")}
            aria-expanded={!sidebarCollapsed}
            onClick={onToggleSidebar}
          />
        </span>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2">
        <LanguageSwitcher label={common("language")} />
        <ThemeToggle label={common("darkMode")} />
        <IconButton icon="bell" label={t("notifications")} />
        <UserMenu name={userName} role={roleLabel(roleName, (name) => roles(name))} />
      </div>
    </header>
  );
}
