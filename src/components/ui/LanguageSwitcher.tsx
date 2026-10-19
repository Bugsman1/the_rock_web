import { useCallback, useRef, useState } from "react";
import { useLocale } from "use-intl";
import { Icon } from "./Icon";
import { useDismiss } from "./useDismiss";
import { Link, usePathname } from "@/i18n/navigation";
import { languageName } from "@/i18n/languageName";
import { locales } from "@/i18n/locales";
import { cn } from "@/lib/cn";

const MENU_ID = "language-menu";

export function LanguageSwitcher({ label }: { label: string }) {
  const pathname = usePathname();
  const current = useLocale();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useDismiss(open, container, close);

  return (
    <div className="flex justify-center">
      <div ref={container} className="relative">
        <button
          type="button"
          aria-haspopup="true"
          aria-expanded={open}
          aria-controls={MENU_ID}
          onClick={() => setOpen((previous) => !previous)}
          className="rounded-field border-line bg-surface text-ink hover:bg-surface-hover inline-flex h-11 cursor-pointer items-center gap-2.5 border-[1.5px] px-3 text-[14px] font-medium"
        >
          <span className="sr-only">{label}</span>
          <Icon name="world" className="h-5 w-5" />
          <span className="hidden sm:inline">{languageName(current)}</span>
          <Icon name="chevron-down" className="text-ink-faint h-4 w-4" />
        </button>

        {open ? (
          <ul
            id={MENU_ID}
            className="divide-line-subtle rounded-field border-line bg-surface shadow-card absolute start-0 top-full z-10 mt-2 w-max min-w-full divide-y overflow-hidden border-[1.5px]"
          >
            {locales.map((locale) => (
              <li key={locale}>
                <Link
                  href={pathname}
                  locale={locale}
                  onClick={() => setOpen(false)}
                  aria-current={locale === current ? "true" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-2.5 px-3 text-[14px] font-medium",
                    locale === current
                      ? "bg-brand-50 text-brand-700"
                      : "text-ink-label hover:bg-surface-hover",
                  )}
                >
                  {languageName(locale)}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
