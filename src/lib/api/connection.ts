export const REQUEST_TIMEOUT_MS = 15_000;

export const CONNECTION_LOST_STATUS = 503;

const UNREACHABLE_STATUSES: ReadonlySet<number> = new Set([502, 503, 504]);

const listeners = new Set<() => void>();

let lost = false;

function setLost(next: boolean) {
  if (lost === next) {
    return;
  }

  lost = next;
  listeners.forEach((listener) => listener());
}

function onBackOnline() {
  setLost(false);
}

export function isConnectionLost(): boolean {
  return lost || !navigator.onLine;
}

export function isUnreachableStatus(status: number): boolean {
  return UNREACHABLE_STATUSES.has(status);
}

export function reportResponse(status: number) {
  setLost(isUnreachableStatus(status));
}

export function reportConnectionFailure() {
  setLost(true);
}

function withRequestTimeout(signal: AbortSignal | null | undefined): AbortSignal {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);

  return signal === null || signal === undefined ? timeout : AbortSignal.any([signal, timeout]);
}

export function connectedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  if (!navigator.onLine) {
    return Promise.reject(new TypeError("The browser is offline."));
  }

  const signal = init.signal ?? (input instanceof Request ? input.signal : undefined);

  return fetch(input, { ...init, signal: withRequestTimeout(signal) });
}

export function subscribeToConnection(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("online", onBackOnline);
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("online", onBackOnline);
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}
