import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { signIn } from "./signIn";

const LOGIN_URL = `${window.location.origin}/api/v1/auth/login/`;
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function tokenWithRole(role: string | null): string {
  return `header.${btoa(JSON.stringify({ exp: 1_900_000_000, role })).replace(/=+$/, "")}.signature`;
}

function answerWith(access: string) {
  server.use(http.post(LOGIN_URL, () => HttpResponse.json({ access, refresh: "refresh-token" })));
}

const values = { email: "manager@mills.mr", password: "secret123", rememberMe: true };

describe("signIn", () => {
  it("keeps the session and gives the role of the account", async () => {
    const access = tokenWithRole("manager");
    answerWith(access);

    expect(await signIn(values)).toEqual({ ok: true, role: "manager" });
    expect(localStorage.getItem("the_rock.access")).toBe(access);
  });

  it("refuses an account without an allowed role and keeps no session", async () => {
    answerWith(tokenWithRole("cashier"));

    expect(await signIn(values)).toEqual({ ok: false, reason: "noAccess" });
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("passes on wrong credentials", async () => {
    server.use(http.post(LOGIN_URL, () => new HttpResponse(null, { status: 401 })));

    expect(await signIn(values)).toEqual({ ok: false, reason: "invalidCredentials" });
    expect(localStorage.length).toBe(0);
  });
});
