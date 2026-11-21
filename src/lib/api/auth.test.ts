import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { requestTokens } from "./auth";

const LOGIN_URL = `${window.location.origin}/api/v1/auth/login/`;
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const credentials = { email: "manager@mills.mr", password: "secret123" };

describe("requestTokens", () => {
  it("sends the credentials and returns the access token", async () => {
    let sent: unknown;
    server.use(
      http.post(LOGIN_URL, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ access: "access-token" });
      }),
    );

    expect(await requestTokens(credentials)).toEqual({ ok: true, access: "access-token" });
    expect(sent).toEqual(credentials);
  });

  it("asks for the server's messages in the page's language, not the browser's", async () => {
    let language: string | null = null;
    server.use(
      http.post(LOGIN_URL, ({ request }) => {
        language = request.headers.get("Accept-Language");
        return HttpResponse.json({ access: "access-token" });
      }),
    );
    document.documentElement.lang = "fr";

    await requestTokens(credentials);

    expect(language).toBe("fr");
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
