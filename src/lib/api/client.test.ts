import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  apiClient,
  attachmentFileName,
  backendFieldErrors,
  errorKind,
  saveOutcome,
  tryLoad,
  unwrap,
} from "./client";
import { isConnectionLost } from "./connection";
import { readSession, saveSession } from "./session";

const ME_URL = `${window.location.origin}/api/v1/auth/me/`;
const REFRESH_URL = `${window.location.origin}/api/v1/auth/refresh/`;
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function tokenExpiringIn(seconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + seconds;

  return `header.${btoa(JSON.stringify({ exp, role: "manager" })).replace(/=+$/, "")}.signature`;
}

function answerMe(seen: { authorization?: string | null }) {
  server.use(
    http.get(ME_URL, ({ request }) => {
      seen.authorization = request.headers.get("Authorization");
      return HttpResponse.json({});
    }),
  );
}

describe("apiClient", () => {
  it("asks for the server's messages in the page's language on every call", async () => {
    let language: string | null = null;
    server.use(
      http.get(ME_URL, ({ request }) => {
        language = request.headers.get("Accept-Language");
        return HttpResponse.json({});
      }),
    );
    document.documentElement.lang = "ar";

    await apiClient.GET("/api/v1/auth/me/");

    expect(language).toBe("ar");
  });

  it("answers 503 and marks the connection lost when the request cannot reach the server", async () => {
    server.use(http.get(ME_URL, () => HttpResponse.error()));

    const { response } = await apiClient.GET("/api/v1/auth/me/");

    expect(response.status).toBe(503);
    expect(isConnectionLost()).toBe(true);

    server.use(http.get(ME_URL, () => HttpResponse.json({})));
    await apiClient.GET("/api/v1/auth/me/");

    expect(isConnectionLost()).toBe(false);
  });

  it("sends the access token of the session", async () => {
    const access = tokenExpiringIn(600);
    saveSession({ access, refresh: tokenExpiringIn(6000) }, true);
    const seen: { authorization?: string | null } = {};
    answerMe(seen);

    await apiClient.GET("/api/v1/auth/me/");

    expect(seen.authorization).toBe(`Bearer ${access}`);
  });

  it("renews an expired access token before sending the request", async () => {
    const renewed = tokenExpiringIn(600);
    saveSession({ access: tokenExpiringIn(-60), refresh: tokenExpiringIn(6000) }, true);
    server.use(http.post(REFRESH_URL, () => HttpResponse.json({ access: renewed })));
    const seen: { authorization?: string | null } = {};
    answerMe(seen);

    await apiClient.GET("/api/v1/auth/me/");

    expect(seen.authorization).toBe(`Bearer ${renewed}`);
    expect(readSession()?.access).toBe(renewed);
  });

  it("ends the session when the server refuses it", async () => {
    saveSession({ access: tokenExpiringIn(600), refresh: tokenExpiringIn(6000) }, true);
    server.use(http.get(ME_URL, () => new HttpResponse(null, { status: 401 })));

    await apiClient.GET("/api/v1/auth/me/");

    expect(readSession()).toBeUndefined();
  });
});

describe("backendFieldErrors", () => {
  it("keeps the first message of each field", () => {
    expect(
      backendFieldErrors({
        full_name: ["This field is required.", "Too long."],
        phone: "Invalid.",
      }),
    ).toEqual({ full_name: "This field is required.", phone: "Invalid." });
  });

  it("ignores bodies that are not field errors", () => {
    expect(backendFieldErrors("Server error")).toEqual({});
    expect(backendFieldErrors({ detail: 42 })).toEqual({});
    expect(backendFieldErrors(undefined)).toEqual({});
  });
});

describe("saveOutcome", () => {
  const toForm = (errors: Readonly<Record<string, string>>) =>
    errors.full_name === undefined ? {} : { name: errors.full_name };

  it("succeeds on a successful response", () => {
    expect(saveOutcome(new Response(null, { status: 201 }), undefined, toForm)).toEqual({
      ok: true,
    });
  });

  it("puts the backend's field errors on the form fields", () => {
    expect(
      saveOutcome(new Response(null, { status: 400 }), { full_name: ["Required."] }, toForm),
    ).toEqual({ ok: false, fieldErrors: { name: "Required." }, failed: false });
  });

  it("reports a failure the form cannot show on a field", () => {
    expect(saveOutcome(new Response(null, { status: 500 }), undefined, toForm)).toEqual({
      ok: false,
      fieldErrors: {},
      failed: true,
    });
  });
});

describe("unwrap", () => {
  it("returns the data of a successful response", () => {
    expect(unwrap({ data: { id: 1 }, response: new Response(null, { status: 200 }) })).toEqual({
      id: 1,
    });
  });

  it("sends a refused session to the login page", () => {
    let thrown: unknown;

    try {
      unwrap({ response: new Response(null, { status: 401 }) });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Response);
    expect(thrown instanceof Response ? thrown.headers.get("Location") : null).toBe("/ar/login");
  });

  it("fails with the status of any other error", () => {
    expect(() => unwrap({ response: new Response(null, { status: 500 }) })).toThrow();
  });
});

describe("errorKind", () => {
  it("names a missing page, a refused permission and any other failure", () => {
    expect(errorKind(404)).toBe("notFound");
    expect(errorKind(403)).toBe("forbidden");
    expect(errorKind(503)).toBe("connection");
    expect(errorKind(504)).toBe("connection");
    expect(errorKind(500)).toBe("failed");
    expect(errorKind(undefined)).toBe("failed");
  });
});

describe("tryLoad", () => {
  it("gives the data when the load works", async () => {
    expect(await tryLoad(async () => [1, 2])).toEqual({ ok: true, data: [1, 2] });
  });

  it("gives the backend's status when the load is refused", async () => {
    expect(
      await tryLoad(async () => {
        throw new Response(null, { status: 403 });
      }),
    ).toEqual({ ok: false, status: 403 });
  });

  it("still lets a redirect to the login page through", async () => {
    const toLogin = new Response(null, { status: 302 });

    await expect(
      tryLoad(async () => {
        throw toLogin;
      }),
    ).rejects.toBe(toLogin);
  });
});

describe("attachmentFileName", () => {
  it("reads the file name the backend gives an attachment", () => {
    expect(attachmentFileName('attachment; filename="FAC-2026-0007.pdf"')).toBe(
      "FAC-2026-0007.pdf",
    );
  });

  it("gives nothing when the backend sends no file name", () => {
    expect(attachmentFileName(null)).toBeUndefined();
    expect(attachmentFileName("attachment")).toBeUndefined();
  });
});
