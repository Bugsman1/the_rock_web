import { redirect } from "react-router";
import createClient from "openapi-fetch";
import { z } from "zod";
import type { Middleware } from "openapi-fetch";
import { defaultLocale, isLocale } from "@/i18n/locales";
import { localizedHref } from "@/i18n/navigation";
import { isTokenExpired } from "@/lib/jwt";
import { LOGIN_HREF } from "@/lib/routes";
import { refreshTokens } from "./auth";
import {
  CONNECTION_LOST_STATUS,
  isUnreachableStatus,
  reportConnectionFailure,
  connectedFetch,
  reportResponse,
} from "./connection";
import type { Readable } from "openapi-typescript-helpers";
import type { components, paths } from "./schema";
import { clearSession, readSession, updateSession } from "./session";

async function currentAccessToken(now: Date): Promise<string | undefined> {
  const session = readSession();

  if (session === undefined) {
    return undefined;
  }

  if (!isTokenExpired(session.access, now)) {
    return session.access;
  }

  const tokens = isTokenExpired(session.refresh, now)
    ? undefined
    : await refreshTokens(session.refresh);

  if (tokens === undefined) {
    clearSession();
    return undefined;
  }

  updateSession(tokens);
  return tokens.access;
}

const sessionMiddleware: Middleware = {
  async onRequest({ request }) {
    const token = await currentAccessToken(new Date());

    request.headers.set("Accept-Language", document.documentElement.lang);

    if (token !== undefined) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }

    return request;
  },
  onResponse({ response }) {
    if (response.status === 401) {
      clearSession();
    }

    return response;
  },
};

const connectionMiddleware: Middleware = {
  onResponse({ response }) {
    reportResponse(response.status);

    return response;
  },
  onError() {
    reportConnectionFailure();

    return new Response(null, { status: CONNECTION_LOST_STATUS });
  },
};

export const apiClient = createClient<paths>({
  baseUrl: window.location.origin,
  fetch: (request) => connectedFetch(request),
});

apiClient.use(sessionMiddleware, connectionMiddleware);

export type ApiSchema<Name extends keyof components["schemas"]> = Readable<
  components["schemas"][Name]
>;

export type FieldErrors<Field extends string> = Partial<Record<Field, string>>;

export type SaveFailure<Field extends string> = {
  ok: false;
  fieldErrors: FieldErrors<Field>;
  failed: boolean;
  message?: string;
  unknown?: true;
};

export type SaveResult<Field extends string> = { ok: true } | SaveFailure<Field>;

export const saveFailed = { ok: false, fieldErrors: {}, failed: true } as const;

const saveUnknown = { ok: false, fieldErrors: {}, failed: true, unknown: true } as const;

function isClientError(status: number): boolean {
  return status >= 400 && status < 500;
}

export type BackendFieldErrors = Readonly<Record<string, string>>;

const drfErrorsSchema = z.record(z.string(), z.union([z.array(z.string()), z.string()]));

export function backendFieldErrors(body: unknown): BackendFieldErrors {
  const parsed = drfErrorsSchema.safeParse(body);

  if (!parsed.success) return {};

  return Object.fromEntries(
    Object.entries(parsed.data).flatMap(([field, messages]) => {
      const message = Array.isArray(messages) ? messages[0] : messages;

      return message === undefined ? [] : [[field, message]];
    }),
  );
}

export function saveOutcome<Field extends string>(
  response: Response,
  error: unknown,
  errorsFromApi: (errors: BackendFieldErrors) => FieldErrors<Field>,
): SaveResult<Field> {
  if (response.ok) {
    return { ok: true };
  }

  if (isUnreachableStatus(response.status)) {
    return saveUnknown;
  }

  const backendErrors = isClientError(response.status) ? backendFieldErrors(error) : {};
  const fieldErrors = response.status === 400 ? errorsFromApi(backendErrors) : {};
  const shown = new Set(Object.values(fieldErrors));
  const unshown = Object.values(backendErrors).filter((message) => !shown.has(message));
  const message = unshown.length === 0 ? undefined : unshown.join(" ");

  return {
    ok: false,
    fieldErrors,
    failed: message !== undefined || Object.keys(fieldErrors).length === 0,
    ...(message === undefined ? {} : { message }),
  };
}

function currentLocale() {
  const [, segment] = window.location.pathname.split("/");

  return isLocale(segment) ? segment : defaultLocale;
}

export function idempotent(key: string) {
  return { header: { "Idempotency-Key": key } };
}

export function notFound(): never {
  throw new Response(null, { status: 404 });
}

export function unwrap<T>({ data, response }: { data?: T; response: Response }): T {
  if (response.status === 401) {
    throw redirect(localizedHref(currentLocale(), LOGIN_HREF));
  }

  if (data === undefined) {
    throw new Response(null, { status: response.status });
  }

  return data;
}

export type ErrorKind = "notFound" | "forbidden" | "connection" | "failed";

export function errorKind(status: number | undefined): ErrorKind {
  if (status === 404) return "notFound";
  if (status === 403) return "forbidden";
  if (status !== undefined && isUnreachableStatus(status)) return "connection";

  return "failed";
}

export type Loaded<T> = { ok: true; data: T } | { ok: false; status: number };

export async function tryLoad<T>(load: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await load() };
  } catch (error) {
    if (error instanceof Response && error.status >= 400) {
      return { ok: false, status: error.status };
    }

    throw error;
  }
}

const ATTACHMENT_FILE_NAME = /filename="([^"]+)"/;

export function attachmentFileName(contentDisposition: string | null): string | undefined {
  return contentDisposition?.match(ATTACHMENT_FILE_NAME)?.[1];
}
