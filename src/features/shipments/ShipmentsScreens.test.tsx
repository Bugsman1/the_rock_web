import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { noAccess } from "@/lib/access";
import { AccessContext } from "@/lib/accessContext";
import messages from "@/messages/fr.json";
import { ShipmentsScreen, shipmentsLoader } from "./ShipmentsScreens";

const allRights = { ...noAccess, superuser: true };

const API = `${window.location.origin}/api/v1`;

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const stamps = {
  is_active: true,
  created_at: "2026-10-01T08:00:00Z",
  updated_at: "2026-10-01T08:00:00Z",
};

const page = (results: readonly object[]) => HttpResponse.json({ count: results.length, results });

function apiProject(id: number, name: string) {
  return { id, name, site: "zouerat", status: "active", ...stamps };
}

function answerProjectList(projects: readonly object[]) {
  server.use(http.get(`${API}/projects/`, () => page(projects)));
}

describe("ShipmentsScreen", () => {
  it("opens the only project of a user limited to one project", async () => {
    answerProjectList([apiProject(3, "Zouérat 1")]);
    server.use(
      http.get(`${API}/shipments/`, () => page([])),
      http.get(`${API}/grinding-operations/`, () => page([])),
    );
    const router = createMemoryRouter(
      [
        { path: "/:locale/shipments", loader: shipmentsLoader, element: <ShipmentsScreen /> },
        { path: "/:locale/shipments/projects/:project", element: <h1>project page</h1> },
      ],
      { initialEntries: ["/fr/shipments"] },
    );

    render(
      <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
        <AccessContext value={allRights}>
          <RouterProvider router={router} />
        </AccessContext>
      </IntlProvider>,
    );

    expect(await screen.findByRole("heading", { name: "project page" })).toBeVisible();
    expect(router.state.location.pathname).toBe("/fr/shipments/projects/3");
  });
});
