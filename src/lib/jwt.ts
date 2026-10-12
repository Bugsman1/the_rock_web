import { z } from "zod";

const payloadSchema = z.object({
  exp: z.number(),
  role: z.string().nullish(),
});

type JwtPayload = z.infer<typeof payloadSchema>;

const EXPIRY_MARGIN_SECONDS = 30;

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");

  return new TextDecoder().decode(Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)));
}

export function decodeJwtPayload(token: string): JwtPayload | undefined {
  const [, payload] = token.split(".");

  if (payload === undefined) return undefined;

  try {
    const parsed = payloadSchema.safeParse(JSON.parse(decodeBase64Url(payload)));

    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export function isTokenExpired(token: string, now: Date): boolean {
  const payload = decodeJwtPayload(token);

  return payload === undefined || payload.exp - EXPIRY_MARGIN_SECONDS <= now.getTime() / 1000;
}
