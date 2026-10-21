import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Drawer } from "./Drawer";

describe("Drawer", () => {
  it("closes itself when it is removed while still open, such as leaving the page", () => {
    const { unmount } = render(
      <Drawer open title="Modifier l'affinage" closeLabel="Fermer" onClose={vi.fn()}>
        <p>Formulaire</p>
      </Drawer>,
    );
    const dialog = screen.getByRole("dialog", { name: "Modifier l'affinage" });

    expect(dialog).toHaveAttribute("open");

    unmount();

    expect(dialog).not.toHaveAttribute("open");
  });

  it("stays open while it is shown", () => {
    render(
      <Drawer open title="Modifier l'affinage" closeLabel="Fermer" onClose={vi.fn()}>
        <p>Formulaire</p>
      </Drawer>,
    );

    expect(screen.getByRole("dialog", { name: "Modifier l'affinage" })).toHaveAttribute("open");
    expect(screen.getByText("Formulaire")).toBeVisible();
  });
});
