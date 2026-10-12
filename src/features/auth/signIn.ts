import { requestTokens } from "@/lib/api/auth";
import { saveSession } from "@/lib/api/session";
import { decodeJwtPayload } from "@/lib/jwt";
import type { LoginValues } from "./schemas/loginSchema";

export type SignInFailure = "invalidCredentials" | "unavailable" | "noAccess";

type SignInResult = { ok: true } | { ok: false; reason: SignInFailure };

export async function signIn({ email, password, rememberMe }: LoginValues): Promise<SignInResult> {
  const result = await requestTokens({ email, password });

  if (!result.ok) {
    return result;
  }

  const role = decodeJwtPayload(result.tokens.access)?.role;

  if (typeof role !== "string" || role === "") {
    return { ok: false, reason: "noAccess" };
  }

  saveSession(result.tokens, rememberMe);

  return { ok: true };
}
