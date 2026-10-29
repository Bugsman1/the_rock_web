import { afterEach, describe, expect, it } from "vitest";
import { applyTheme, currentTheme, storeTheme } from "./theme";

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("theme", () => {
  it("is light until dark is applied", () => {
    expect(currentTheme()).toBe("light");
  });

  it("remembers the chosen theme under the key the page reads on load", () => {
    storeTheme("dark");

    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("applies the theme to the page", () => {
    applyTheme("dark");

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(currentTheme()).toBe("dark");
  });
});
