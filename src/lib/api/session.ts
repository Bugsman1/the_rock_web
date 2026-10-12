import { roleOfToken } from "@/lib/access";
import type { UserRole } from "@/lib/access";
import { isTokenExpired } from "@/lib/jwt";

export type SessionTokens = {
  access: string;
  refresh: string;
};

const ACCESS_KEY = "the_rock.access";
const REFRESH_KEY = "the_rock.refresh";

export function clearSession(): void {
  for (const store of [localStorage, sessionStorage]) {
    store.removeItem(ACCESS_KEY);
    store.removeItem(REFRESH_KEY);
  }
}

export function saveSession(tokens: SessionTokens, remember: boolean): void {
  clearSession();

  const store = remember ? localStorage : sessionStorage;
  store.setItem(ACCESS_KEY, tokens.access);
  store.setItem(REFRESH_KEY, tokens.refresh);
}

export function updateSession(tokens: SessionTokens): void {
  saveSession(tokens, localStorage.getItem(REFRESH_KEY) !== null);
}

export function readSession(): SessionTokens | undefined {
  for (const store of [localStorage, sessionStorage]) {
    const access = store.getItem(ACCESS_KEY);
    const refresh = store.getItem(REFRESH_KEY);

    if (access !== null && refresh !== null) {
      return { access, refresh };
    }
  }

  return undefined;
}

export function sessionRole(now: Date): UserRole | undefined {
  const session = readSession();

  return session === undefined || isTokenExpired(session.refresh, now)
    ? undefined
    : roleOfToken(session.access);
}
