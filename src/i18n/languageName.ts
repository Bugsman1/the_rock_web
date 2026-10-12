import type { Locale } from "./locales";

export function languageName(locale: Locale): string {
  const name = new Intl.DisplayNames([locale], { type: "language" }).of(locale);

  if (name === undefined) {
    return locale;
  }

  return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
}
