import { TIME_ZONE } from "@/i18n/locales";
import type { IsoTimestamp } from "./format";

const INPUT_DATE_LOCALE = "en-CA";
const INPUT_TIME_LOCALE = "en-GB";

export function todayAsInputValue(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat(INPUT_DATE_LOCALE, {
    calendar: "gregory",
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function nowAsTimeValue(now: Date = new Date()): string {
  return new Intl.DateTimeFormat(INPUT_TIME_LOCALE, {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DISPLAY_DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const DISPLAY_DATE_DIGITS = 8;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const TIME_DIGITS = 4;

function isCalendarDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function isIsoDate(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value);

  return match !== null && isCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]));
}

export function isoDateToDisplay(value: string): string {
  const match = ISO_DATE_PATTERN.exec(value);

  return match === null ? value : `${match[3]}/${match[2]}/${match[1]}`;
}

export function displayDateToIso(value: string): string | undefined {
  const match = DISPLAY_DATE_PATTERN.exec(value);

  if (match === null) {
    return undefined;
  }

  const iso = `${match[3]}-${match[2]}-${match[1]}`;

  return isIsoDate(iso) ? iso : undefined;
}

export function maskDisplayDate(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, DISPLAY_DATE_DIGITS);

  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)]
    .filter((part) => part !== "")
    .join("/");
}

export function isTimeValue(value: string): boolean {
  return TIME_PATTERN.test(value);
}

export function maskTimeValue(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, TIME_DIGITS);

  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

export function combineDateAndTime(date: string, time: string): IsoTimestamp | undefined {
  if (!isIsoDate(date) || !isTimeValue(time)) {
    return undefined;
  }

  return `${date}T${time}:00.000Z`;
}

const MS_PER_HOUR = 60 * 60 * 1000;
const MINUTES_PER_HOUR = 60;

export function addHours(timestamp: IsoTimestamp, hours: number): IsoTimestamp {
  return new Date(new Date(timestamp).getTime() + hours * MS_PER_HOUR).toISOString();
}

export function hoursBetween(start: IsoTimestamp, end: IsoTimestamp): number {
  return (new Date(end).getTime() - new Date(start).getTime()) / MS_PER_HOUR;
}

export function isSameDay(a: IsoTimestamp, b: IsoTimestamp): boolean {
  return todayAsInputValue(new Date(a)) === todayAsInputValue(new Date(b));
}

export function durationParts(
  start: IsoTimestamp,
  end: IsoTimestamp,
): { hours: number; minutes: number } {
  const totalMinutes = Math.max(0, Math.round(hoursBetween(start, end) * MINUTES_PER_HOUR));

  return {
    hours: Math.floor(totalMinutes / MINUTES_PER_HOUR),
    minutes: totalMinutes % MINUTES_PER_HOUR,
  };
}
