export const locales = ["ar", "fr"] as const;

export type Locale = (typeof locales)[number];

type Direction = "rtl" | "ltr";

export const defaultLocale: Locale = "ar";

export const localeDirection = {
  ar: "rtl",
  fr: "ltr",
} as const satisfies Record<Locale, Direction>;

export function isLocale(value: unknown): value is Locale {
  return locales.some((locale) => locale === value);
}

export const TIME_ZONE = "Africa/Nouakchott";

const NUMBERING_SYSTEM = "latn";

export function toIntlLocale(locale: Locale): string {
  return `${locale}-u-nu-${NUMBERING_SYSTEM}`;
}
