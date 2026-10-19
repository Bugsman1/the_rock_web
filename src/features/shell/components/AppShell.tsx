import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { ToastProvider } from "@/components/ui/Toast";
import type { Access } from "@/lib/access";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

type AppShellProps = {
  access: Access;
  userName: string;
  roleName: string;
  children: ReactNode;
};

export function AppShell({ access, userName, roleName, children }: AppShellProps) {
  const common = useTranslations("common");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  return (
    <ToastProvider anchor={mainRef}>
      <div className="bg-surface-page flex h-dvh flex-col overflow-hidden">
        <TopBar
          roleName={roleName}
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
            access={access}
            collapsed={collapsed}
            mobileOpen={mobileOpen}
            onNavigate={() => setMobileOpen(false)}
          />
          <main ref={mainRef} className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
