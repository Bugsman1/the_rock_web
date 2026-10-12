import { describe, expect, it } from "vitest";
import { isLocale } from "./locales";

describe("isLocale", () => {
  it("accepts the two supported languages", () => {
    expect(isLocale("ar")).toBe(true);
    expect(isLocale("fr")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isLocale("en")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});
