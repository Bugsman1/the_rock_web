import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "./Toast";

function SaveButton() {
  const toast = useToast();

  return (
    <button type="button" onClick={() => toast("Saved")}>
      Save
    </button>
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("ToastProvider", () => {
  it("shows the message for a moment, then hides it by itself", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider anchor={{ current: null }}>
        <SaveButton />
      </ToastProvider>,
    );

    expect(screen.queryByRole("status", { hidden: true })).toBeNull();
    act(() => {
      screen.getByRole("button", { name: "Save" }).click();
    });
    expect(screen.getByRole("status", { hidden: true })).toHaveTextContent("Saved");

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.queryByRole("status", { hidden: true })).toBeNull();
  });
});
