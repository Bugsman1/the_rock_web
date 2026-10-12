import { describe, expect, it } from "vitest";
import { formatPhone, isSamePhone, isValidPhone, sanitizePhone } from "./phone";

describe("sanitizePhone", () => {
  it("keeps digits, spaces and a leading plus only", () => {
    expect(sanitizePhone("+222 22a-41+18")).toBe("+222 224118");
  });
});

describe("isValidPhone", () => {
  it("accepts a local number with or without the country code", () => {
    expect(isValidPhone("22334455")).toBe(true);
    expect(isValidPhone("+222 22 33 44 55")).toBe(true);
    expect(isValidPhone("22233445")).toBe(true);
  });

  it("rejects a number with the wrong length", () => {
    expect(isValidPhone("2233445")).toBe(false);
    expect(isValidPhone("+222 22 33 44 556")).toBe(false);
  });
});

describe("isSamePhone", () => {
  it("matches the same number written with or without the country code", () => {
    expect(isSamePhone("+222 22 41 18 30", "22411830")).toBe(true);
  });

  it("tells different numbers apart", () => {
    expect(isSamePhone("+222 22 41 18 30", "+222 22 41 18 31")).toBe(false);
  });
});

describe("formatPhone", () => {
  it("writes every valid number in the same +222 XX XX XX XX form", () => {
    expect(formatPhone("22411830")).toBe("+222 22 41 18 30");
    expect(formatPhone("+22222411830")).toBe("+222 22 41 18 30");
    expect(formatPhone("+222 22 41 18 30")).toBe("+222 22 41 18 30");
  });
});
