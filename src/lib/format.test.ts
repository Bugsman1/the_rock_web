import { describe, expect, it } from "vitest";
import {
  amountOrZero,
  formatCount,
  formatDate,
  formatDateTime,
  formatMoney,
  formatQuantity,
  formatTime,
  fromDecimal,
  roundMoney,
  toDecimal,
  toMoneyDecimal,
} from "./format";

describe("formatCount", () => {
  it("renders whole counts", () => {
    expect(formatCount(0, "ar")).toBe("0");
    expect(formatCount(7, "fr")).toBe("7");
  });

  it("keeps half bags", () => {
    expect(formatCount(1.5, "fr")).toBe("1,5");
    expect(formatCount(0.5, "ar")).toBe("0.5");
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

describe("roundMoney", () => {
  it("rounds an amount to the cent", () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(12.345)).toBe(12.35);
    expect(roundMoney(1000)).toBe(1000);
  });
});

describe("amountOrZero", () => {
  it("keeps an amount above zero and turns an empty or negative one into 0", () => {
    expect(amountOrZero(12.5)).toBe(12.5);
    expect(amountOrZero(Number.NaN)).toBe(0);
    expect(amountOrZero(-3)).toBe(0);
  });
});

describe("toMoneyDecimal", () => {
  it("sends the amount as typed, to the cent", () => {
    expect(toMoneyDecimal(1000)).toBe("1000");
    expect(toMoneyDecimal(12.5)).toBe("12.5");
    expect(toMoneyDecimal(0.004)).toBe("0");
  });
});

const FRENCH_GROUP_SEPARATOR = " ";

describe("formatMoney", () => {
  it("shows the amount as typed, the same figure as on the invoice", () => {
    expect(formatMoney(1000, "ar")).toBe("1,000");
    expect(formatMoney(12.5, "fr")).toBe("12,5");
  });

  it("groups thousands per locale", () => {
    expect(formatMoney(12345, "ar")).toBe("12,345");
    expect(formatMoney(12345, "fr")).toBe(`12${FRENCH_GROUP_SEPARATOR}345`);
  });

  it("marks a debit balance as negative", () => {
    expect(formatMoney(-12345, "fr")).toBe(`-12${FRENCH_GROUP_SEPARATOR}345`);
  });

  it("keeps the negative digits intact in Arabic, which adds bidi marks", () => {
    expect(formatMoney(-12345, "ar")).toContain("-12,345");
  });

  it("renders zero without a sign", () => {
    expect(formatMoney(0, "fr")).toBe("0");
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
