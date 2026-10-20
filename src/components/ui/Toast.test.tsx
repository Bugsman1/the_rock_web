import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { createMemoryRouter, Outlet, RouterProvider, useNavigation } from "react-router";
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

function SaveAndLeave({ onSaved }: { onSaved: () => void }) {
  const toast = useToast();

  return (
    <button
      type="button"
      onClick={() => {
        toast("Saved");
        onSaved();
      }}
    >
      Save
    </button>
  );
}

function RouterToast({ children }: { children: ReactNode }) {
  const busy = useNavigation().state !== "idle";

  return (
    <ToastProvider anchor={{ current: null }} busy={busy}>
      {children}
    </ToastProvider>
  );
}

describe("ToastProvider while the page loads", () => {
  it("waits until the next page has loaded before showing the message", async () => {
    const { promise: loaded, resolve: finishLoading } = Promise.withResolvers<null>();
    const router = createMemoryRouter([
      {
        element: (
          <RouterToast>
            <Outlet />
          </RouterToast>
        ),
        children: [
          { path: "/", element: <SaveAndLeave onSaved={() => void router.navigate("/list")} /> },
          { path: "/list", loader: () => loaded, element: <h1>List</h1> },
        ],
      },
    ]);
    render(<RouterProvider router={router} />);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await act(() => Promise.resolve());

    expect(screen.getByRole("button", { name: "Save" })).toBeVisible();
    expect(screen.queryByRole("status", { hidden: true })).toBeNull();

    await act(async () => {
      finishLoading(null);
      await loaded;
    });

    expect(await screen.findByRole("heading", { name: "List" })).toBeVisible();
    expect(screen.getByRole("status", { hidden: true })).toHaveTextContent("Saved");
  });
});
