import { roleOfToken } from "@/lib/access";
import type { UserRole } from "@/lib/access";
import { requestTokens } from "@/lib/api/auth";
import { saveSession } from "@/lib/api/session";
import type { LoginValues } from "./schemas/loginSchema";

export type SignInFailure = "invalidCredentials" | "unavailable" | "noAccess";

type SignInResult = { ok: true; role: UserRole } | { ok: false; reason: SignInFailure };

export async function signIn({ email, password, rememberMe }: LoginValues): Promise<SignInResult> {
  const result = await requestTokens({ email, password });

  if (!result.ok) {
    return result;
  }

  const role = roleOfToken(result.tokens.access);

  if (role === undefined) {
    return { ok: false, reason: "noAccess" };
  }

  saveSession(result.tokens, rememberMe);

  return { ok: true, role };
}
