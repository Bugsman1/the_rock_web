import { describe, expect, it } from "vitest";
import { clearSession, hasSession, readSession, saveSession } from "./session";

const now = new Date("2026-10-11T12:00:00Z");

function token(payload: object): string {
  return `header.${btoa(JSON.stringify(payload)).replace(/=+$/, "")}.signature`;
}

function tokenFor(role: string, secondsLeft: number): string {
  return token({ exp: now.getTime() / 1000 + secondsLeft, role });
}

describe("saveSession", () => {
  it("keeps a remembered session after the browser closes", () => {
    saveSession("access-token", true);

    expect(localStorage.getItem("the_rock.access")).toBe("access-token");
    expect(sessionStorage.length).toBe(0);
  });

  it("keeps a session that is not remembered only for this tab", () => {
    saveSession("access-token", false);

    expect(sessionStorage.getItem("the_rock.access")).toBe("access-token");
    expect(localStorage.length).toBe(0);
  });

  it("drops the previous session when signing in again", () => {
    saveSession("access-token", true);
    saveSession("new-access", false);

    expect(localStorage.length).toBe(0);
    expect(readSession()).toBe("new-access");
  });
});

describe("readSession and clearSession", () => {
  it("finds nothing when signed out", () => {
    expect(readSession()).toBeUndefined();
  });

  it("forgets the session", () => {
    saveSession("access-token", true);
    clearSession();

    expect(readSession()).toBeUndefined();
  });
});

describe("hasSession", () => {
  it("is signed in while the access token is valid", () => {
    saveSession(tokenFor("supervisor", 600), true);

    expect(hasSession(now)).toBe(true);
  });

  it("is signed out once the access token has expired or when there is none", () => {
    expect(hasSession(now)).toBe(false);

    saveSession(tokenFor("manager", -60), true);

    expect(hasSession(now)).toBe(false);
  });
});
