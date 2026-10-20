import { z } from "zod";
import { connectedFetch, reportConnectionFailure, reportResponse } from "./connection";
import type { SessionTokens } from "./session";

const LOGIN_PATH = "/api/v1/auth/login/";
const REFRESH_PATH = "/api/v1/auth/refresh/";

const tokensSchema = z.object({ access: z.string().min(1), refresh: z.string().min(1) });
const refreshedSchema = z.object({
  access: z.string().min(1),
  refresh: z.string().min(1).optional(),
});

type Credentials = {
  email: string;
  password: string;
};

type TokenRequestResult =
  { ok: true; tokens: SessionTokens } | { ok: false; reason: "invalidCredentials" | "unavailable" };

async function postJson(path: string, body: object): Promise<Response | undefined> {
  try {
    const response = await connectedFetch(new URL(path, window.location.origin), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });

    reportResponse(response.status);
    return response;
  } catch {
    reportConnectionFailure();
    return undefined;
  }
}

export async function requestTokens(credentials: Credentials): Promise<TokenRequestResult> {
  const response = await postJson(LOGIN_PATH, credentials);

  if (response === undefined || response.status >= 500) {
    return { ok: false, reason: "unavailable" };
  }

  const parsed = response.ok ? tokensSchema.safeParse(await response.json()) : undefined;

  return parsed?.success === true
    ? { ok: true, tokens: parsed.data }
    : { ok: false, reason: "invalidCredentials" };
}

export async function refreshTokens(refresh: string): Promise<SessionTokens | undefined> {
  const response = await postJson(REFRESH_PATH, { refresh });

  if (response === undefined || !response.ok) {
    return undefined;
  }

  const parsed = refreshedSchema.safeParse(await response.json());

  return parsed.success
    ? { access: parsed.data.access, refresh: parsed.data.refresh ?? refresh }
    : undefined;
}
