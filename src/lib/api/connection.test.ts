import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  connectedFetch,
  isConnectionLost,
  isUnreachableStatus,
  reportConnectionFailure,
  reportResponse,
  subscribeToConnection,
} from "./connection";

beforeEach(() => {
  reportResponse(200);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("connection", () => {
  it("is lost when a request fails or the server cannot be reached, and back on the next answer", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToConnection(listener);

    reportConnectionFailure();
    expect(isConnectionLost()).toBe(true);

    reportResponse(200);
    expect(isConnectionLost()).toBe(false);

    reportResponse(504);
    expect(isConnectionLost()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(3);

    unsubscribe();
  });

  it("is back as soon as the browser is online again", () => {
    const unsubscribe = subscribeToConnection(vi.fn());

    reportConnectionFailure();
    window.dispatchEvent(new Event("online"));

    expect(isConnectionLost()).toBe(false);
    unsubscribe();
  });

  it("is lost while the browser is offline", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);

    expect(isConnectionLost()).toBe(true);
  });

  it("treats only a gateway or unavailable answer as a lost server", () => {
    expect([502, 503, 504].every(isUnreachableStatus)).toBe(true);
    expect([200, 400, 404, 500].some(isUnreachableStatus)).toBe(false);
  });

  it("fails at once without calling the network while the browser is offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const network = vi.spyOn(globalThis, "fetch");

    await expect(connectedFetch("/api/v1/auth/me/")).rejects.toThrow(TypeError);
    expect(network).not.toHaveBeenCalled();
  });

  it("gives every request a time limit and still lets its caller cancel it", async () => {
    const network = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null));
    const controller = new AbortController();

    await connectedFetch("/api/v1/auth/me/", { signal: controller.signal });
    const signal = network.mock.calls[0]?.[1]?.signal;
    controller.abort();

    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal?.aborted).toBe(true);
  });
});
