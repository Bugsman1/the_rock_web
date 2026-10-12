import { useState } from "react";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import type { UserRole } from "@/lib/access";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

type AppShellProps = {
  role: UserRole;
  userName: string;
  children: ReactNode;
};

export function AppShell({ role, userName, children }: AppShellProps) {
  const common = useTranslations("common");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="bg-surface-page flex h-dvh flex-col overflow-hidden">
      <TopBar
        role={role}
        userName={userName}
        sidebarCollapsed={collapsed}
        mobileMenuOpen={mobileOpen}
        onToggleSidebar={() => setCollapsed((previous) => !previous)}
        onToggleMobileMenu={() => setMobileOpen((previous) => !previous)}
      />

      <div className="flex min-h-0 flex-1">
        {mobileOpen ? (
          <button
            type="button"
            aria-label={common("close")}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-x-0 top-16 bottom-0 z-30 bg-neutral-900/40 md:hidden"
          />
        ) : null}
        <Sidebar
          role={role}
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onNavigate={() => setMobileOpen(false)}
        />
        <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
