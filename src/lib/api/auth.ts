import { z } from "zod";
import { connectedFetch, reportConnectionFailure, reportResponse } from "./connection";

const LOGIN_PATH = "/api/v1/auth/login/";

const tokenSchema = z.object({ access: z.string().min(1) });

type Credentials = {
  email: string;
  password: string;
};

type TokenRequestResult =
  { ok: true; access: string } | { ok: false; reason: "invalidCredentials" | "unavailable" };

async function postJson(path: string, body: object): Promise<Response | undefined> {
  try {
    const response = await connectedFetch(new URL(path, window.location.origin), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Language": document.documentElement.lang,
      },
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

  const parsed = response.ok ? tokenSchema.safeParse(await response.json()) : undefined;

  return parsed?.success === true
    ? { ok: true, access: parsed.data.access }
    : { ok: false, reason: "invalidCredentials" };
}
