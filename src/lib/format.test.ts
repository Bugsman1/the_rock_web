import { describe, expect, it } from "vitest";
import {
  formatCount,
  formatDate,
  formatDateTime,
  formatMoney,
  formatQuantity,
  formatTime,
  fromDecimal,
  toDecimal,
  toOldOuguiya,
} from "./format";

describe("formatCount", () => {
  it("renders whole counts", () => {
    expect(formatCount(0, "ar")).toBe("0");
    expect(formatCount(7, "fr")).toBe("7");
  });

  it("groups large counts per locale", () => {
    expect(formatCount(12345, "ar")).toBe("12,345");
    expect(formatCount(12345, "fr")).toBe("12 345");
  });

  it("keeps Latin digits in Arabic rather than Arabic-Indic", () => {
    expect(formatCount(1234, "ar")).toBe("1,234");
  });
});

describe("formatDate", () => {
  it("renders an ISO timestamp as a day in Nouakchott time", () => {
    expect(formatDate("2026-10-05T23:30:00Z", "fr")).toBe("05/10/2026");
  });
});

describe("formatDateTime", () => {
  it("renders a 24 hour clock in Nouakchott time", () => {
    expect(formatDateTime("2026-10-05T23:30:00Z", "fr")).toBe("05/10/2026 23:30");
  });
});

describe("formatTime", () => {
  it("renders the hour and minutes in Nouakchott time", () => {
    expect(formatTime("2026-10-05T23:30:00Z", "fr")).toBe("23:30");
  });
});

describe("toOldOuguiya", () => {
  it("turns new ouguiya into whole old ouguiya", () => {
    expect(toOldOuguiya(12.5)).toBe(125);
    expect(toOldOuguiya(0.04)).toBe(0);
  });
});

const FRENCH_GROUP_SEPARATOR = " ";

describe("formatMoney", () => {
  it("renders ten old ouguiya as one new ouguiya", () => {
    expect(formatMoney(10, "fr")).toBe("1,0");
  });

  it("keeps the sub-unit digit instead of rounding it away", () => {
    expect(formatMoney(5, "fr")).toBe("0,5");
    expect(formatMoney(1, "fr")).toBe("0,1");
  });

  it("groups thousands per locale", () => {
    expect(formatMoney(12345, "ar")).toBe("1,234.5");
    expect(formatMoney(12345, "fr")).toBe(`1${FRENCH_GROUP_SEPARATOR}234,5`);
  });

  it("marks a debit balance as negative", () => {
    expect(formatMoney(-12345, "fr")).toBe(`-1${FRENCH_GROUP_SEPARATOR}234,5`);
  });

  it("keeps the negative digits intact in Arabic, which adds bidi marks", () => {
    expect(formatMoney(-12345, "ar")).toContain("-1,234.5");
  });

  it("renders zero without a sign", () => {
    expect(formatMoney(0, "fr")).toBe("0,0");
  });

  it("stays exact at the top of the safe integer range", () => {
    expect(formatMoney(9007199254740990, "ar")).toBe("900,719,925,474,099.0");
  });
});

describe("fromDecimal", () => {
  it("reads a decimal sent by the backend", () => {
    expect(fromDecimal("12.500")).toBe(12.5);
    expect(fromDecimal("0.000")).toBe(0);
  });
});

describe("toDecimal", () => {
  it("writes a number with the three decimals the backend keeps", () => {
    expect(toDecimal(12.5)).toBe("12.500");
    expect(toDecimal(0.0004)).toBe("0.000");
  });
});

describe("formatQuantity", () => {
  it("keeps up to three decimals and groups per locale", () => {
    expect(formatQuantity(1234.5, "ar")).toBe("1,234.5");
    expect(formatQuantity(1234.5678, "fr")).toBe("1 234,568");
    expect(formatQuantity(2, "fr")).toBe("2");
  });
});
