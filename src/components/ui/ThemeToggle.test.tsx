import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "./ThemeToggle";

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("ThemeToggle", () => {
  it("switches to dark mode and back, and remembers the choice", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle label="Mode sombre" />);

    const toggle = screen.getByRole("button", { name: "Mode sombre" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem("theme")).toBe("dark");

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("shows dark mode as on when the page is already dark", () => {
    document.documentElement.dataset.theme = "dark";
    render(<ThemeToggle label="Mode sombre" />);

    expect(screen.getByRole("button", { name: "Mode sombre" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
