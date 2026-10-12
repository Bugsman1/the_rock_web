import { useEffect } from "react";
import { Outlet, useParams } from "react-router";
import { IntlProvider } from "use-intl";
import { defaultLocale, isLocale, localeDirection, TIME_ZONE } from "@/i18n/locales";
import type { Locale } from "@/i18n/locales";
import { messages } from "@/i18n/messages";
import { Redirect } from "@/i18n/navigation";
import { LOGIN_HREF } from "@/lib/routes";

function useDocumentLanguage(locale: Locale) {
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = localeDirection[locale];
    document.title = messages[locale].common.appName;
  }, [locale]);
}

function LocalizedOutlet({ locale }: { locale: Locale }) {
  useDocumentLanguage(locale);

  return (
    <IntlProvider locale={locale} messages={messages[locale]} timeZone={TIME_ZONE}>
      <Outlet />
    </IntlProvider>
  );
}

export function LocaleLayout() {
  const { locale } = useParams();

  if (!isLocale(locale)) {
    return <Redirect locale={defaultLocale} href={LOGIN_HREF} />;
  }

  return <LocalizedOutlet locale={locale} />;
}
