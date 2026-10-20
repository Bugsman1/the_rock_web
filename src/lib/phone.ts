const LOCAL_DIGITS = 8;
const COUNTRY_CODE = "222";

export const PHONE_PLACEHOLDER = "+222 XX XX XX XX";

export function sanitizePhone(value: string): string {
  return value.replace(/[^\d +]/g, "").replace(/(?!^)\+/g, "");
}

export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");

  return (
    digits.length === LOCAL_DIGITS ||
    (digits.length === COUNTRY_CODE.length + LOCAL_DIGITS && digits.startsWith(COUNTRY_CODE))
  );
}

function localDigits(value: string): string {
  return value.replace(/\D/g, "").slice(-LOCAL_DIGITS);
}

export function isSamePhone(a: string, b: string): boolean {
  return localDigits(a) === localDigits(b);
}

export function formatPhone(value: string): string {
  if (!isValidPhone(value)) {
    return value;
  }

  const pairs = localDigits(value).match(/\d{2}/g) ?? [];

  return `+${COUNTRY_CODE} ${pairs.join(" ")}`;
}

export function phoneToApi(value: string): string {
  return `+${COUNTRY_CODE}${localDigits(value)}`;
}
