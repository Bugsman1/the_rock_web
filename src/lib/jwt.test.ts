import { describe, expect, it } from "vitest";
import { decodeJwtPayload, isTokenExpired } from "./jwt";

function token(payload: object): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  return `${encode({ alg: "HS256" })}.${encode(payload)}.signature`;
}

const now = new Date("2026-10-09T12:00:00Z");
const nowSeconds = now.getTime() / 1000;

describe("decodeJwtPayload", () => {
  it("reads the expiry and role of a token", () => {
    expect(decodeJwtPayload(token({ exp: 1_800_000_000, role: "manager" }))).toEqual({
      exp: 1_800_000_000,
      role: "manager",
    });
  });

  it("rejects malformed tokens", () => {
    expect(decodeJwtPayload("not-a-token")).toBeUndefined();
    expect(decodeJwtPayload("a.%%%.c")).toBeUndefined();
    expect(decodeJwtPayload(token({ role: "manager" }))).toBeUndefined();
  });
});

describe("isTokenExpired", () => {
  it("is false while the token is valid", () => {
    expect(isTokenExpired(token({ exp: nowSeconds + 600 }), now)).toBe(false);
  });

  it("is true once expired or about to expire", () => {
    expect(isTokenExpired(token({ exp: nowSeconds - 1 }), now)).toBe(true);
    expect(isTokenExpired(token({ exp: nowSeconds + 10 }), now)).toBe(true);
  });

  it("treats an unreadable token as expired", () => {
    expect(isTokenExpired("garbage", now)).toBe(true);
  });
});
