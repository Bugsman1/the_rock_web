import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { saveSession } from "@/lib/api/session";
import messages from "@/messages/fr.json";
import {
  GrinderFormScreen,
  grinderFormLoader,
  ProjectSettingsScreen,
  projectLoader,
  ProjectsScreen,
  projectsLoader,
} from "./ProjectScreens";
import {
  LanguageScreen,
  ProfileScreen,
  profileLoader,
  SettingsHomeScreen,
  settingsHomeLoader,
  settingsSectionsFor,
} from "./SettingsScreens";

const settingsRoutes = [
  { path: "settings", loader: settingsHomeLoader, element: <SettingsHomeScreen /> },
  { path: "settings/profile", loader: profileLoader, element: <ProfileScreen /> },
  { path: "settings/language", element: <LanguageScreen /> },
  { path: "settings/projects", loader: projectsLoader, element: <ProjectsScreen /> },
  { path: "settings/projects/:project", loader: projectLoader, element: <ProjectSettingsScreen /> },
  {
    path: "settings/projects/:project/machines/new",
    loader: grinderFormLoader,
    element: <GrinderFormScreen />,
  },
];

const API = `${window.location.origin}/api/v1`;
const server = setupServer();
const text = messages.settings;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const stamps = {
  is_active: true,
  created_at: "2026-10-01T08:00:00Z",
  updated_at: "2026-10-01T08:00:00Z",
};

const zouerat = { id: 3, name: "Zouérat 1", site: "zouerat", status: "active", ...stamps };

function signInAs(role: string) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `header.${btoa(JSON.stringify({ exp, role })).replace(/=+$/, "")}.signature`;
  saveSession({ access: token, refresh: token }, true);
}

function answerProjects() {
  server.use(
    http.get(`${API}/projects/`, () => HttpResponse.json({ count: 1, results: [zouerat] })),
    http.get(`${API}/projects/3/`, () => HttpResponse.json(zouerat)),
    http.get(`${API}/grinders/`, () =>
      HttpResponse.json({
        count: 2,
        results: [
          { id: 9, project: 3, code: "P3-7", status: "maintenance", ...stamps },
          { id: 8, project: 3, code: "P3-2", status: "active", ...stamps },
        ],
      }),
    ),
  );
}

function openAt(path: string) {
  const router = createMemoryRouter([{ path: "/fr", children: settingsRoutes }], {
    initialEntries: [path],
  });

  render(
    <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
      <RouterProvider router={router} />
    </IntlProvider>,
  );

  return router;
}

describe("settingsSectionsFor", () => {
  it("gives the manager every section", () => {
    expect(settingsSectionsFor("manager").map((section) => section.key)).toEqual([
      "profile",
      "language",
      "projects",
    ]);
  });

  it("gives the supervisor their own settings only", () => {
    expect(settingsSectionsFor("supervisor").map((section) => section.key)).toEqual([
      "profile",
      "language",
    ]);
  });
});

describe("settings home", () => {
  it("opens each setting on its own page", async () => {
    signInAs("manager");
    openAt("/fr/settings");

    expect(
      await screen.findByRole("link", { name: new RegExp(text.projects.title) }),
    ).toHaveAttribute("href", "/fr/settings/projects");
    expect(screen.getByRole("link", { name: new RegExp(text.profile.title) })).toHaveAttribute(
      "href",
      "/fr/settings/profile",
    );
  });

  it("filters the settings and says when nothing matches", async () => {
    signInAs("manager");
    const user = userEvent.setup();
    openAt("/fr/settings");

    await user.type(await screen.findByLabelText(text.searchLabel), text.language.title);

    expect(screen.getAllByRole("link")).toHaveLength(1);

    await user.type(screen.getByLabelText(text.searchLabel), "zzz");

    expect(screen.getByText(text.noResults)).toBeVisible();
  });

  it("shows a supervisor only their own settings", async () => {
    signInAs("supervisor");
    openAt("/fr/settings");

    await screen.findByRole("link", { name: new RegExp(text.profile.title) });
    expect(
      screen.queryByRole("link", { name: new RegExp(text.projects.title) }),
    ).not.toBeInTheDocument();
  });
});

describe("profile", () => {
  it("shows the signed-in user's details", async () => {
    server.use(
      http.get(`${API}/auth/me/`, () =>
        HttpResponse.json({
          id: 4,
          email: "aicha@mills.mr",
          full_name: "Aicha",
          phone: "",
          role: { id: 2, name: "supervisor" },
        }),
      ),
    );
    openAt("/fr/settings/profile");

    expect(await screen.findByText("aicha@mills.mr")).toBeVisible();
    expect(screen.getAllByText(messages.roles.supervisor).length).toBeGreaterThan(0);
    expect(screen.getByText(text.profile.none)).toBeVisible();
  });
});

describe("language", () => {
  it("marks the current language and links the other to this page", async () => {
    openAt("/fr/settings/language");

    const french = await screen.findByRole("link", { name: /Français/ });
    expect(french).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: /العربية/ })).toHaveAttribute(
      "href",
      "/ar/settings/language",
    );
  });
});

describe("projects", () => {
  it("lists the projects with their machine count", async () => {
    answerProjects();
    openAt("/fr/settings/projects");

    expect(await screen.findByRole("heading", { name: "Zouérat 1" })).toBeVisible();
    expect(screen.getByRole("link", { name: new RegExp(text.projects.open) })).toHaveAttribute(
      "href",
      "/fr/settings/projects/3",
    );
    expect(screen.getByText("2")).toBeVisible();
  });

  it("shows a project with its machines in order", async () => {
    answerProjects();
    openAt("/fr/settings/projects/3");

    const table = await screen.findByRole("table");
    const [, ...rows] = within(table).getAllByRole("row");
    expect(rows.map((row) => within(row).getAllByRole("cell")[0]?.textContent)).toEqual([
      "Machine 2",
      "Machine 7",
    ]);
    expect(screen.getByRole("link", { name: "Modifier la machine 7" })).toHaveAttribute(
      "href",
      "/fr/settings/projects/3/machines/9",
    );
  });

  it("deletes a project after asking, then goes back to the projects", async () => {
    answerProjects();
    let deleted = false;
    server.use(
      http.delete(`${API}/projects/3/`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    openAt("/fr/settings/projects/3");
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("link", { name: new RegExp(text.projects.delete.open) }),
    );
    const dialog = within(await screen.findByRole("dialog", { name: text.projects.delete.title }));
    expect(dialog.getByText("Voulez-vous supprimer le projet Zouérat 1 ?")).toBeVisible();
    expect(deleted).toBe(false);

    await user.click(
      dialog.getByRole("button", { name: new RegExp(text.projects.delete.confirm) }),
    );

    expect(await screen.findByRole("heading", { name: text.projects.title })).toBeVisible();
    expect(deleted).toBe(true);
  });

  it("says when a project could not be deleted", async () => {
    answerProjects();
    server.use(http.delete(`${API}/projects/3/`, () => new HttpResponse(null, { status: 500 })));
    openAt("/fr/settings/projects/3?delete=1");
    const user = userEvent.setup();

    const dialog = within(await screen.findByRole("dialog", { name: text.projects.delete.title }));
    await user.click(
      dialog.getByRole("button", { name: new RegExp(text.projects.delete.confirm) }),
    );

    expect(await dialog.findByText(text.projects.delete.failed)).toBeVisible();
  });

  it("hints the next free machine number without filling it in", async () => {
    answerProjects();
    openAt("/fr/settings/projects/3/machines/new");

    expect(await screen.findByLabelText(text.grinders.fields.number)).toHaveValue(null);
    expect(screen.getByText("Prochain numéro libre : 8")).toBeVisible();
  });

  it("goes back to the project after adding a machine", async () => {
    answerProjects();
    server.use(http.post(`${API}/grinders/`, () => HttpResponse.json({}, { status: 201 })));
    const user = userEvent.setup();
    const router = openAt("/fr/settings/projects/3/machines/new");

    await user.type(await screen.findByLabelText(text.grinders.fields.number), "8");
    await user.click(screen.getByRole("button", { name: text.grinders.form.create }));

    expect(await screen.findByRole("table")).toBeVisible();
    expect(router.state.location.pathname).toBe("/fr/settings/projects/3");
  });
});
