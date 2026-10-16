import { useTranslations } from "use-intl";
import logoUrl from "@/icons/logo_soukhour.svg";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { roleLabel } from "@/lib/users";

type UserBadgeProps = {
  name: string;
  role: string;
};

function UserBadge({ name, role }: UserBadgeProps) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="bg-brand-50 text-brand-700 inline-flex size-9 shrink-0 items-center justify-center rounded-full">
        <Icon name="user" />
      </span>

      <span className="hidden min-w-0 flex-col text-start sm:flex">
        <span className="text-ink truncate text-[14px] font-semibold">{name}</span>
        <span className="text-ink-muted truncate text-[12px]">{role}</span>
      </span>
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
        <IconButton icon="bell" label={t("notifications")} />
        <UserBadge name={userName} role={roleLabel(roleName, (name) => roles(name))} />
      </div>
    </header>
  );
}
