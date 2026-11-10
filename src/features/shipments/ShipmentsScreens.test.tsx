import { render, screen, within } from "@testing-library/react";
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

function apiStorage(project: number, name: string, customers: number, bags: string) {
  return { project, project_name: name, customers_with_bags: customers, bags_in_storage: bags };
}

const topCustomers = [
  {
    project: 3,
    project_name: "Zouérat 1",
    total_bags: "40.0",
    results: [
      { id: 7, full_name: "Ahmed", phone: "+22222411830", bags: "30.0", percentage: "75.00" },
      { id: 8, full_name: "Sidi", phone: "+22246109325", bags: "10.0", percentage: "25.00" },
    ],
  },
  { project: 4, project_name: "Zouérat 2", total_bags: "0.0", results: [] },
];

function openOverview() {
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

  return router;
}

async function cardOf(name: string) {
  const heading = await screen.findByRole("heading", { name });
  const card = heading.closest("section");

  if (card === null) {
    throw new Error(`${name} card missing`);
  }

  return within(card);
}

describe("ShipmentsScreen", () => {
  it("opens the only project of a user limited to one project", async () => {
    answerProjectList([apiProject(3, "Zouérat 1")]);
    const router = openOverview();

    expect(await screen.findByRole("heading", { name: "project page" })).toBeVisible();
    expect(router.state.location.pathname).toBe("/fr/shipments/projects/3");
  });

  it("shows each project's clients and bags in storage, and the total of the projects shown", async () => {
    answerProjectList([apiProject(3, "Zouérat 1"), apiProject(4, "Zouérat 2")]);
    server.use(
      http.get(`${API}/shipments/summary/`, () =>
        HttpResponse.json([
          apiStorage(3, "Zouérat 1", 2, "8.5"),
          apiStorage(4, "Zouérat 2", 1, "4.0"),
          apiStorage(5, "Ancien", 1, "1.0"),
        ]),
      ),
      http.get(`${API}/customers/top-by-bags/per-project/`, () => HttpResponse.json(topCustomers)),
    );
    openOverview();

    const card = await cardOf("Zouérat 1");
    expect(card.getByText("8,5")).toBeVisible();
    expect(card.getByText("2")).toBeVisible();
    expect((await cardOf("Zouérat 2")).getByText("4")).toBeVisible();
    expect(screen.getByText("12,5")).toBeVisible();
  });

  it("shows each project's top customers by their share of its bags", async () => {
    answerProjectList([apiProject(3, "Zouérat 1"), apiProject(4, "Zouérat 2")]);
    server.use(
      http.get(`${API}/shipments/summary/`, () => HttpResponse.json([])),
      http.get(`${API}/customers/top-by-bags/per-project/`, () => HttpResponse.json(topCustomers)),
    );
    openOverview();

    const first = await cardOf("Zouérat 1");
    const [ahmed, sidi] = first.getAllByRole("listitem");
    expect(ahmed).toHaveTextContent("Ahmed30 sacs");
    expect(sidi).toHaveTextContent("Sidi10 sacs");
    expect(ahmed?.querySelector("[style]")).toHaveStyle({ width: "75%" });
    expect(sidi?.querySelector("[style]")).toHaveStyle({ width: "25%" });

    const second = await cardOf("Zouérat 2");
    expect(second.getByText(messages.shipments.noClients)).toBeVisible();
  });

  it("keeps the cards when the top customers cannot be loaded, and says why", async () => {
    answerProjectList([apiProject(3, "Zouérat 1"), apiProject(4, "Zouérat 2")]);
    server.use(
      http.get(`${API}/shipments/summary/`, () =>
        HttpResponse.json([apiStorage(3, "Zouérat 1", 1, "6.0")]),
      ),
      http.get(
        `${API}/customers/top-by-bags/per-project/`,
        () => new HttpResponse(null, { status: 403 }),
      ),
    );
    openOverview();

    const card = await cardOf("Zouérat 1");
    expect(card.getByText("6")).toBeVisible();
    expect(card.getByText(messages.errors.forbidden.description)).toBeVisible();
  });
});
