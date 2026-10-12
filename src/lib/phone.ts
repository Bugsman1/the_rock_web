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

export function isSamePhone(a: string, b: string): boolean {
  const local = (value: string) => value.replace(/\D/g, "").slice(-LOCAL_DIGITS);

  return local(a) === local(b);
}

export function formatPhone(value: string): string {
  const local = value.replace(/\D/g, "").slice(-LOCAL_DIGITS);
  const pairs = local.match(/\d{2}/g) ?? [];

  return `+${COUNTRY_CODE} ${pairs.join(" ")}`;
}
