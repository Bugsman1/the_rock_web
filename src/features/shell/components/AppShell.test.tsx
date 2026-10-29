import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { describe, expect, it, vi } from "vitest";
import { modules, rightsFromApi } from "@/lib/access";
import type { Access, Module } from "@/lib/access";
import { reportConnectionFailure, reportResponse } from "@/lib/api/connection";
import { readSession, saveSession } from "@/lib/api/session";
import messages from "@/messages/fr.json";
import { AppShell } from "./AppShell";

const nav = messages.shell.nav;

function viewing(viewable: readonly Module[]): Access {
  return {
    userId: "",
    superuser: false,
    rights: rightsFromApi(viewable.map((module) => ({ module, can_view: true }))),
  };
}

const everything = viewing(modules);
const supervisor = viewing(["shipments", "grinding", "refining", "customers"]);

function renderShell(access: Access = everything, roleName = "manager", path = "/fr/shipments") {
  const router = createMemoryRouter(
    [
      { path: "/fr/login", element: <p>login page</p> },
      {
        path: "/fr/*",
        element: (
          <AppShell access={access} userName="Sidi" roleName={roleName}>
            <p>page</p>
          </AppShell>
        ),
      },
    ],
    { initialEntries: [path] },
  );

  return render(
    <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
      <RouterProvider router={router} />
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
  it("shows only the account icon, which opens the name, role, profile and logout", async () => {
    const user = userEvent.setup();
    renderShell(supervisor, "supervisor");

    expect(screen.queryByText("Sidi")).toBeNull();
    await user.click(
      screen.getByRole("button", { name: messages.shell.userMenu.replace("{name}", "Sidi") }),
    );

    expect(screen.getByText("Sidi")).toBeInTheDocument();
    expect(screen.getByText(messages.roles.supervisor)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: messages.shell.profile })).toHaveAttribute(
      "href",
      "/fr/settings/profile",
    );
    expect(screen.getAllByRole("button", { name: messages.shell.logout })).toHaveLength(2);
  });

  it("shows the company logo and no search of its own", () => {
    renderShell();

    expect(screen.getByRole("img", { name: messages.common.companyName })).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).toBeNull();
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

  it("shows a custom role by its name", async () => {
    const user = userEvent.setup();
    renderShell(supervisor, "Contrôleur");

    await user.click(
      screen.getByRole("button", { name: messages.shell.userMenu.replace("{name}", "Sidi") }),
    );
    expect(screen.getByText("Contrôleur")).toBeInTheDocument();
  });

  it("shows a role that can view everything every section and the settings", () => {
    renderShell();

    expect(screen.getByRole("link", { name: nav.dashboard })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: nav.users })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: messages.shell.settings })).toBeInTheDocument();
  });

  it("shows only the sections the role can view and the settings", () => {
    renderShell(supervisor, "supervisor");

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

  it("reloads the page data once the connection comes back", async () => {
    const loader = vi.fn(() => null);
    const router = createMemoryRouter(
      [
        {
          path: "/fr/*",
          loader,
          element: (
            <AppShell access={everything} userName="Sidi" roleName="manager">
              <p>page</p>
            </AppShell>
          ),
        },
      ],
      { initialEntries: ["/fr/shipments"] },
    );
    render(
      <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
        <RouterProvider router={router} />
      </IntlProvider>,
    );
    await screen.findByText("page");
    expect(loader).toHaveBeenCalledTimes(1);

    act(() => reportConnectionFailure());
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(loader).toHaveBeenCalledTimes(1);

    act(() => reportResponse(200));
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
