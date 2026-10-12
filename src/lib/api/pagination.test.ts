import { describe, expect, it } from "vitest";
import { fetchAllPages, parsePageNumber, toPage } from "./pagination";

describe("toPage", () => {
  it("maps the results and counts the pages", () => {
    expect(toPage({ count: 51, results: [1, 2] }, 3, (value) => value * 10)).toEqual({
      items: [10, 20],
      total: 51,
      page: 3,
      pageCount: 3,
    });
  });

  it("always has at least one page", () => {
    expect(toPage({ count: 0, results: [] }, 1, String).pageCount).toBe(1);
  });
});

describe("parsePageNumber", () => {
  it("reads a positive page number from the URL", () => {
    expect(parsePageNumber("4")).toBe(4);
  });

  it("falls back to the first page for anything else", () => {
    expect(parsePageNumber(null)).toBe(1);
    expect(parsePageNumber("0")).toBe(1);
    expect(parsePageNumber("-2")).toBe(1);
    expect(parsePageNumber("2abc")).toBe(1);
  });
});

describe("fetchAllPages", () => {
  it("reads every page until all the results are in", async () => {
    const pages = [[1, 2], [3, 4], [5]];
    const requested: number[] = [];

    const items = await fetchAllPages(async (page) => {
      requested.push(page);
      return { count: 5, results: pages[page - 1] ?? [] };
    });

    expect(items).toEqual([1, 2, 3, 4, 5]);
    expect(requested).toEqual([1, 2, 3]);
  });

  it("stops on an empty page", async () => {
    expect(await fetchAllPages(async () => ({ count: 9, results: [] }))).toEqual([]);
  });
});
