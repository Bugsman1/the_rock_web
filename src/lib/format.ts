import { TIME_ZONE, toIntlLocale } from "@/i18n/locales";
import type { Locale } from "@/i18n/locales";

const CALENDAR = "gregory";

export type IsoTimestamp = string;

export function formatCount(value: number, locale: Locale): string {
  return new Intl.NumberFormat(toIntlLocale(locale), { maximumFractionDigits: 1 }).format(value);
}

export function formatDate(timestamp: IsoTimestamp, locale: Locale): string {
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    calendar: CALENDAR,
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}

export function formatDateTime(timestamp: IsoTimestamp, locale: Locale): string {
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    calendar: CALENDAR,
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

export function formatTime(timestamp: IsoTimestamp, locale: Locale): string {
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

const MONEY_CENTS = 100;

export function toMoneyDecimal(amount: number): string {
  return String(Math.round(amount * MONEY_CENTS) / MONEY_CENTS);
}

export function formatMoney(amount: number, locale: Locale): string {
  return new Intl.NumberFormat(toIntlLocale(locale), { maximumFractionDigits: 2 }).format(amount);
}

const DECIMAL_PLACES = 3;

export function fromDecimal(value: string): number {
  return Number(value);
}

export function toDecimal(value: number): string {
  return value.toFixed(DECIMAL_PLACES);
}

export function formatQuantity(value: number, locale: Locale): string {
  return new Intl.NumberFormat(toIntlLocale(locale), {
    maximumFractionDigits: DECIMAL_PLACES,
  }).format(value);
}
