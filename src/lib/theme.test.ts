import { afterEach, describe, expect, it } from "vitest";
import { applyTheme, currentTheme, storedTheme, storeTheme } from "./theme";

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("theme", () => {
  it("starts light when nothing was chosen", () => {
    expect(storedTheme()).toBe("light");
    expect(currentTheme()).toBe("light");
  });

  it("remembers the chosen theme", () => {
    storeTheme("dark");

    expect(storedTheme()).toBe("dark");
  });

  it("ignores an unknown stored value", () => {
    localStorage.setItem("theme", "purple");

    expect(storedTheme()).toBe("light");
  });

  it("applies the theme to the page", () => {
    applyTheme("dark");

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(currentTheme()).toBe("dark");
  });
});
