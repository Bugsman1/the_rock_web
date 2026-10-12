import { describe, expect, it } from "vitest";
import { matchesSearch } from "./search";

const item = { texts: ["محمد ولد أحمد", "SH-1001"], phone: "+222 22 41 18 30" };

describe("matchesSearch", () => {
  it("matches everything for a blank search", () => {
    expect(matchesSearch(item, "  ")).toBe(true);
  });

  it("finds part of any text, ignoring case", () => {
    expect(matchesSearch(item, "ولد")).toBe(true);
    expect(matchesSearch(item, "sh-1001")).toBe(true);
  });

  it("finds a phone typed with or without spaces", () => {
    expect(matchesSearch(item, "4118")).toBe(true);
    expect(matchesSearch(item, "41 18 30")).toBe(true);
  });

  it("rejects an unrelated search", () => {
    expect(matchesSearch(item, "Fatima")).toBe(false);
    expect(matchesSearch(item, "9999")).toBe(false);
  });
});
