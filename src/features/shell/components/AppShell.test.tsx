import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { IntlProvider } from "use-intl";
import { describe, expect, it } from "vitest";
import type { UserRole } from "@/lib/access";
import { readSession, saveSession } from "@/lib/api/session";
import messages from "@/messages/fr.json";
import { AppShell } from "./AppShell";

const nav = messages.shell.nav;

function renderShell(role: UserRole = "manager", path = "/fr/shipments") {
  return render(
    <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/fr/login" element={<p>login page</p>} />
          <Route
            path="/fr/*"
            element={
              <AppShell role={role} userName="Sidi">
                <p>page</p>
              </AppShell>
            }
          />
        </Routes>
      </MemoryRouter>
    </IntlProvider>,
  );
}

function phoneMenuButton() {
  const [phoneButton] = screen.getAllByRole("button", { name: messages.shell.toggleSidebar });

  if (phoneButton === undefined) {
    throw new Error("phone menu button missing");
  }

  return phoneButton;
}

function desktopMenuButton() {
  const desktopButton = screen.getAllByRole("button", { name: messages.shell.toggleSidebar })[1];

  if (desktopButton === undefined) {
    throw new Error("desktop menu button missing");
  }

  return desktopButton;
}

describe("AppShell", () => {
  it("shows who is signed in and their role", () => {
    renderShell("supervisor");

    expect(screen.getByText("Sidi")).toBeInTheDocument();
    expect(screen.getByText(messages.roles.supervisor)).toBeInTheDocument();
  });

  it("marks the current section and moves to another one", async () => {
    const user = userEvent.setup();
    renderShell();

    const shipments = screen.getByRole("link", { name: nav.shipments });
    const milling = screen.getByRole("link", { name: nav.milling });
    expect(shipments).toHaveAttribute("aria-current", "page");

    await user.click(milling);

    expect(milling).toHaveAttribute("aria-current", "page");
    expect(milling).toHaveClass("bg-brand-50");
    expect(shipments).not.toHaveAttribute("aria-current");
  });

  it("shows the manager every section and the settings", () => {
    renderShell();

    expect(screen.getByRole("link", { name: nav.dashboard })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: nav.users })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: messages.shell.settings })).toBeInTheDocument();
  });

  it("shows a supervisor only the operations pages and their settings", () => {
    renderShell("supervisor");

    expect(screen.getByRole("link", { name: nav.shipments })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: nav.refining })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: nav.dashboard })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: nav.users })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: messages.shell.settings })).toBeInTheDocument();
  });

  it("keeps only the icons when the desktop menu is collapsed", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(desktopMenuButton());

    expect(screen.getByText(nav.milling)).toHaveClass("sr-only");
    expect(desktopMenuButton()).toHaveAttribute("aria-expanded", "false");
  });

  it("opens the phone menu over the page and closes it from the backdrop", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(desktopMenuButton());
    await user.click(phoneMenuButton());

    expect(phoneMenuButton()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(nav.milling)).not.toHaveClass("sr-only");

    await user.click(screen.getByRole("button", { name: messages.common.close }));

    expect(phoneMenuButton()).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the phone menu once a section is chosen", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(phoneMenuButton());
    await user.click(screen.getByRole("link", { name: nav.milling }));

    expect(phoneMenuButton()).toHaveAttribute("aria-expanded", "false");
  });

  it("signs out and returns to the login page", async () => {
    saveSession({ access: "access-token", refresh: "refresh-token" }, true);
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: messages.shell.logout }));

    expect(readSession()).toBeUndefined();
    expect(screen.getByText("login page")).toBeInTheDocument();
  });
});
