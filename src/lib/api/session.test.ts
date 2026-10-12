import { describe, expect, it } from "vitest";
import { clearSession, hasSession, readSession, saveSession, updateSession } from "./session";

const tokens = { access: "access-token", refresh: "refresh-token" };
const now = new Date("2026-10-11T12:00:00Z");

function token(payload: object): string {
  return `header.${btoa(JSON.stringify(payload)).replace(/=+$/, "")}.signature`;
}

function tokenFor(role: string, secondsLeft: number): string {
  return token({ exp: now.getTime() / 1000 + secondsLeft, role });
}

describe("saveSession", () => {
  it("keeps a remembered session after the browser closes", () => {
    saveSession(tokens, true);

    expect(localStorage.getItem("the_rock.access")).toBe("access-token");
    expect(localStorage.getItem("the_rock.refresh")).toBe("refresh-token");
    expect(sessionStorage.length).toBe(0);
  });

  it("keeps a session that is not remembered only for this tab", () => {
    saveSession(tokens, false);

    expect(sessionStorage.getItem("the_rock.access")).toBe("access-token");
    expect(localStorage.length).toBe(0);
  });

  it("drops the previous session when signing in again", () => {
    saveSession(tokens, true);
    saveSession({ access: "new-access", refresh: "new-refresh" }, false);

    expect(localStorage.length).toBe(0);
    expect(readSession()).toEqual({ access: "new-access", refresh: "new-refresh" });
  });
});

describe("updateSession", () => {
  it("stores refreshed tokens where the session already was", () => {
    saveSession(tokens, true);
    updateSession({ access: "new-access", refresh: "new-refresh" });

    expect(localStorage.getItem("the_rock.access")).toBe("new-access");
    expect(sessionStorage.length).toBe(0);
  });

  it("keeps a tab-only session tab-only", () => {
    saveSession(tokens, false);
    updateSession({ access: "new-access", refresh: "new-refresh" });

    expect(sessionStorage.getItem("the_rock.access")).toBe("new-access");
    expect(localStorage.length).toBe(0);
  });
});

describe("readSession and clearSession", () => {
  it("finds nothing when signed out", () => {
    expect(readSession()).toBeUndefined();
  });

  it("forgets the session", () => {
    saveSession(tokens, true);
    clearSession();

    expect(readSession()).toBeUndefined();
  });
});

describe("hasSession", () => {
  it("is signed in while the session can still be renewed", () => {
    saveSession(
      { access: tokenFor("supervisor", -60), refresh: tokenFor("supervisor", 600) },
      true,
    );

    expect(hasSession(now)).toBe(true);
  });

  it("is signed out once the session has ended or when there is none", () => {
    expect(hasSession(now)).toBe(false);

    saveSession({ access: tokenFor("manager", 600), refresh: tokenFor("manager", -60) }, true);

    expect(hasSession(now)).toBe(false);
  });
});
