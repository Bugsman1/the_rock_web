import { isTokenExpired } from "@/lib/jwt";

const ACCESS_KEY = "the_rock.access";

export function clearSession(): void {
  for (const store of [localStorage, sessionStorage]) {
    store.removeItem(ACCESS_KEY);
  }
}

export function saveSession(access: string, remember: boolean): void {
  clearSession();

  const store = remember ? localStorage : sessionStorage;
  store.setItem(ACCESS_KEY, access);
}

export function readSession(): string | undefined {
  for (const store of [localStorage, sessionStorage]) {
    const access = store.getItem(ACCESS_KEY);

    if (access !== null) {
      return access;
    }
  }

  return undefined;
}

export function hasSession(now: Date): boolean {
  const access = readSession();

  return access !== undefined && !isTokenExpired(access, now);
}
