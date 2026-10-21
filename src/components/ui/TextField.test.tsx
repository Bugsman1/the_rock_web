import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextField } from "./TextField";

describe("TextField", () => {
  it("changes a number only when the user types it, never with the wheel or arrow keys", () => {
    render(<TextField id="bags" label="Sacs" type="number" defaultValue="2" />);
    const field = screen.getByLabelText("Sacs");

    field.focus();
    fireEvent.wheel(field, { deltaY: -100 });
    expect(field).not.toHaveFocus();
    expect(field).toHaveValue(2);

    field.focus();
    expect(fireEvent.keyDown(field, { key: "ArrowUp" })).toBe(false);
    expect(fireEvent.keyDown(field, { key: "ArrowDown" })).toBe(false);
    expect(fireEvent.keyDown(field, { key: "5" })).toBe(true);
  });

  it("leaves a text field alone", () => {
    render(<TextField id="name" label="Nom" defaultValue="Ahmed" />);
    const field = screen.getByLabelText("Nom");

    field.focus();
    fireEvent.wheel(field, { deltaY: -100 });

    expect(field).toHaveFocus();
    expect(fireEvent.keyDown(field, { key: "ArrowUp" })).toBe(true);
  });
});
