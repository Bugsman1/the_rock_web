import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { refreshTokens, requestTokens } from "./auth";

const LOGIN_URL = `${window.location.origin}/api/v1/auth/login/`;
const REFRESH_URL = `${window.location.origin}/api/v1/auth/refresh/`;
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const credentials = { email: "manager@mills.mr", password: "secret123" };

describe("requestTokens", () => {
  it("sends the credentials and returns the tokens", async () => {
    let sent: unknown;
    server.use(
      http.post(LOGIN_URL, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ access: "access-token", refresh: "refresh-token" });
      }),
    );

    expect(await requestTokens(credentials)).toEqual({
      ok: true,
      tokens: { access: "access-token", refresh: "refresh-token" },
    });
    expect(sent).toEqual(credentials);
  });

  it("reports wrong credentials", async () => {
    server.use(
      http.post(LOGIN_URL, () => HttpResponse.json({ detail: "No account" }, { status: 401 })),
    );

    expect(await requestTokens(credentials)).toEqual({ ok: false, reason: "invalidCredentials" });
  });

  it("reports an unavailable server", async () => {
    server.use(http.post(LOGIN_URL, () => new HttpResponse(null, { status: 502 })));

    expect(await requestTokens(credentials)).toEqual({ ok: false, reason: "unavailable" });
  });

  it("reports a network failure as an unavailable server", async () => {
    server.use(http.post(LOGIN_URL, () => HttpResponse.error()));

    expect(await requestTokens(credentials)).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("refreshTokens", () => {
  it("returns the new tokens", async () => {
    let sent: unknown;
    server.use(
      http.post(REFRESH_URL, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ access: "new-access", refresh: "new-refresh" });
      }),
    );

    expect(await refreshTokens("old-refresh")).toEqual({
      access: "new-access",
      refresh: "new-refresh",
    });
    expect(sent).toEqual({ refresh: "old-refresh" });
  });

  it("keeps the refresh token when the server sends only a new access token", async () => {
    server.use(http.post(REFRESH_URL, () => HttpResponse.json({ access: "new-access" })));

    expect(await refreshTokens("old-refresh")).toEqual({
      access: "new-access",
      refresh: "old-refresh",
    });
  });

  it("gives nothing when the session cannot be renewed", async () => {
    server.use(http.post(REFRESH_URL, () => new HttpResponse(null, { status: 401 })));

    expect(await refreshTokens("old-refresh")).toBeUndefined();
  });
});
