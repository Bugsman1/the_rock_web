import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Icon } from "./Icon";

describe("Icon", () => {
  it("hides a decorative icon from assistive technology", () => {
    const { container } = render(<Icon name="user" />);
    const svg = container.querySelector("svg");

    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("exposes an accessible name when given a title", () => {
    render(<Icon name="lock-password" title="Password" />);

    expect(screen.getByRole("img")).toHaveAccessibleName("Password");
  });

  it("lets the caller override the default size", () => {
    const { container } = render(<Icon name="eye" className="size-8" />);

    expect(container.querySelector("svg")).toHaveClass("size-8");
  });

  it("inherits color from the surrounding text", () => {
    const { container } = render(<Icon name="eye-off" />);

    expect(container.querySelector("svg")).toHaveAttribute("stroke", "currentColor");
  });
});
