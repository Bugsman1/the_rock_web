import { useState } from "react";
import { useLoaderData } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { DetailList } from "@/components/ui/Cards";
import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/Icon";
import { PageLayout, PageTitle } from "@/components/ui/PageHeader";
import { SearchField } from "@/components/ui/SearchField";
import { languageName } from "@/i18n/languageName";
import { locales } from "@/i18n/locales";
import type { Locale } from "@/i18n/locales";
import { Link } from "@/i18n/navigation";
import { accessFromApi, canOpen } from "@/lib/access";
import type { Access } from "@/lib/access";
import { apiClient, unwrap } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { profileFromApi } from "@/lib/profile";
import {
  SETTINGS_HREF,
  SETTINGS_LANGUAGE_HREF,
  SETTINGS_PROFILE_HREF,
  SETTINGS_PROJECTS_HREF,
} from "@/lib/routes";
import { matchesSearch } from "@/lib/search";
import { roleLabel } from "@/lib/users";

type SettingsSectionKey = "profile" | "language" | "projects";

const settingsSections: readonly { key: SettingsSectionKey; href: string; icon: IconName }[] = [
  { key: "profile", href: SETTINGS_PROFILE_HREF, icon: "user" },
  { key: "language", href: SETTINGS_LANGUAGE_HREF, icon: "world" },
  { key: "projects", href: SETTINGS_PROJECTS_HREF, icon: "mill" },
];

export function settingsSectionsFor(access: Access) {
  return settingsSections.filter((section) => canOpen(access, section.href));
}

export async function settingsHomeLoader() {
  return { access: accessFromApi(unwrap(await apiClient.GET("/api/v1/auth/me/"))) };
}

export function SettingsHomeScreen() {
  const { access } = useLoaderData<typeof settingsHomeLoader>();
  const t = useTranslations("settings");
  const [query, setQuery] = useState("");
  const cards = settingsSectionsFor(access)
    .map((section) => ({
      ...section,
      title: t(`${section.key}.title`),
      description: t(`${section.key}.description`),
    }))
    .filter((card) => matchesSearch({ texts: [card.title, card.description], phone: "" }, query));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageTitle>{t("title")}</PageTitle>

      <div className="max-w-xl">
        <SearchField
          id="settings-search"
          label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {cards.length === 0 ? (
        <p className="text-ink-muted text-[15px] font-semibold">{t("noResults")}</p>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <li key={card.href}>
              <Link
                href={card.href}
                className="rounded-card border-line bg-surface shadow-subtle hover:shadow-card hover:border-brand-700 focus-visible:shadow-focus flex h-full min-h-44 flex-col gap-4 border-[1.5px] p-6 transition-[translate,box-shadow] duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline-none"
              >
                <span className="bg-brand-50 text-brand-700 inline-flex size-14 items-center justify-center rounded-full">
                  <Icon name={card.icon} className="size-7" />
                </span>
                <span className="flex flex-1 flex-col gap-1.5">
                  <span className="text-ink text-[20px] font-bold">{card.title}</span>
                  <span className="text-ink-muted text-[15px] font-semibold">
                    {card.description}
                  </span>
                </span>
                <Icon name="arrow-right" className="text-brand-700 size-5 self-end" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export async function profileLoader() {
  return profileFromApi(unwrap(await apiClient.GET("/api/v1/auth/me/")));
}

export function ProfileScreen() {
  const profile = useLoaderData<typeof profileLoader>();
  const t = useTranslations("settings.profile");
  const common = useTranslations("common");
  const roles = useTranslations("roles");
  const role =
    profile.roleName === "" ? t("none") : roleLabel(profile.roleName, (name) => roles(name));

  return (
    <PageLayout
      backHref={SETTINGS_HREF}
      backLabel={common("back")}
      title={t("title")}
      description={t("description")}
    >
      <section className="rounded-card border-line bg-surface shadow-subtle flex flex-col gap-6 border-[1.5px] p-6">
        <div className="border-line-subtle flex items-center gap-4 border-b-[1.5px] pb-6">
          <span className="bg-brand-50 text-brand-700 inline-flex size-16 shrink-0 items-center justify-center rounded-full">
            <Icon name="user" className="size-8" />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-ink text-[22px] font-bold break-words">
              <bdi>{profile.name}</bdi>
            </p>
            <p className="text-ink-muted text-[15px] font-semibold">{role}</p>
          </div>
        </div>

        <DetailList
          items={[
            { label: t("name"), value: profile.name },
            { label: t("email"), value: profile.email },
            { label: t("phone"), value: profile.phone === "" ? t("none") : profile.phone },
            { label: t("role"), value: role },
          ]}
        />
      </section>
    </PageLayout>
  );
}

const flags: Record<Locale, IconName> = { ar: "flag-mr", fr: "flag-fr" };

export function LanguageScreen() {
  const t = useTranslations("settings.language");
  const common = useTranslations("common");
  const current = useLocale();

  return (
    <PageLayout
      backHref={SETTINGS_HREF}
      backLabel={common("back")}
      title={t("title")}
      description={t("description")}
    >
      <ul className="grid gap-3 sm:grid-cols-2">
        {locales.map((locale) => {
          const selected = locale === current;

          return (
            <li key={locale}>
              <Link
                href={SETTINGS_LANGUAGE_HREF}
                locale={locale}
                aria-current={selected ? "true" : undefined}
                className={cn(
                  "rounded-card bg-surface shadow-subtle flex min-h-28 items-center gap-4 border-[1.5px] p-6",
                  selected ? "border-brand-700" : "border-line hover:border-line-strong",
                )}
              >
                <Icon name={flags[locale]} className="size-10 shrink-0" />
                <span lang={locale} className="text-ink flex-1 text-[20px] font-bold">
                  {languageName(locale)}
                </span>
                {selected ? (
                  <span className="text-brand-700 inline-flex items-center gap-1.5 text-[14px] font-semibold">
                    <Icon name="circle-check" className="size-5" />
                    {t("current")}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </PageLayout>
  );
}
