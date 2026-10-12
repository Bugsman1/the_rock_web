import { render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { noAccess, rightsFromApi } from "@/lib/access";
import type { Access } from "@/lib/access";
import { AccessContext } from "@/lib/accessContext";
import messages from "@/messages/fr.json";
import {
  InventoryProjectScreen,
  inventoryProjectLoader,
  InventoryScreen,
  inventoryLoader,
  ResourceScreen,
  resourceLoader,
} from "./InventoryScreens";

const allRights: Access = { ...noAccess, superuser: true };

const API = `${window.location.origin}/api/v1`;
const server = setupServer();
const text = messages.inventory;

const page = (results: readonly object[]) => HttpResponse.json({ count: results.length, results });

const zouerat = {
  id: 3,
  name: "Zouérat 1",
  site: "zouerat",
  status: "active",
  is_active: true,
  created_at: "2026-10-01T08:00:00Z",
  updated_at: "2026-10-01T08:00:00Z",
};

const mercury = {
  id: 2,
  project: 3,
  project_name: "Zouérat 1",
  name: "Mercure",
  initial_quantity: "10.000",
  current_quantity: "8.500",
  created_at: "2026-10-12T08:00:00Z",
  updated_at: "2026-10-12T08:00:00Z",
};

const decrease = {
  id: 11,
  resource: 2,
  resource_name: "Mercure",
  project_name: "Zouérat 1",
  change_type: "decrease",
  quantity: "1.500",
  quantity_before: "10.000",
  quantity_after: "8.500",
  refining_operation: 5,
  shipment_number: "SH-4",
  note: "Lot 4",
  created_by_name: "Aicha",
  created_at: "2026-10-12T11:00:00Z",
};

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  server.use(
    http.get(`${API}/projects/`, () => page([zouerat, { ...zouerat, id: 4, name: "Sfariyat 1" }])),
    http.get(`${API}/projects/3/`, () => HttpResponse.json(zouerat)),
    http.get(`${API}/resources/`, () => page([mercury])),
    http.get(`${API}/resources/2/`, () => HttpResponse.json(mercury)),
    http.get(`${API}/resource-history/`, () => page([decrease])),
  );
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function openAt(path: string, access: Access = allRights) {
  const router = createMemoryRouter(
    [
      {
        path: "/fr",
        children: [
          { path: "inventory", loader: inventoryLoader, element: <InventoryScreen /> },
          {
            path: "inventory/projects/:project",
            loader: inventoryProjectLoader,
            element: <InventoryProjectScreen />,
          },
          {
            path: "inventory/resources/:resource",
            loader: resourceLoader,
            element: <ResourceScreen />,
          },
        ],
      },
    ],
    { initialEntries: [path] },
  );

  render(
    <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
      <AccessContext value={access}>
        <RouterProvider router={router} />
      </AccessContext>
    </IntlProvider>,
  );
}

function cellsOf(row: HTMLElement | undefined) {
  if (row === undefined) {
    throw new Error("row missing");
  }

  return within(row)
    .getAllByRole("cell")
    .map((cell) => cell.textContent);
}

function cardOf(title: string) {
  const card = screen.getByRole("heading", { name: title }).closest("section");

  if (card === null) {
    throw new Error(`no card ${title}`);
  }

  return within(card);
}

async function findCardOf(title: string) {
  await screen.findByRole("heading", { name: title });

  return cardOf(title);
}

describe("InventoryScreen", () => {
  it("shows every project, to open the one whose resources you want", async () => {
    openAt("/fr/inventory");

    const cardLink = async (title: string) => {
      const card = (await screen.findByRole("heading", { name: title })).closest("section");

      if (card === null) {
        throw new Error(`no card ${title}`);
      }

      return within(card).getByRole("link", { name: messages.common.openProject });
    };

    expect(await cardLink("Projet Zouérat 1")).toHaveAttribute("href", "/fr/inventory/projects/3");
    expect(await cardLink("Projet Sfariyat 1")).toHaveAttribute("href", "/fr/inventory/projects/4");
  });

  it("shows the project's mercury first and every other resource as a card", async () => {
    let askedProject: string | null = null;
    server.use(
      http.get(`${API}/resources/`, ({ request }) => {
        askedProject = new URL(request.url).searchParams.get("project");
        return page([
          { ...mercury, id: 6, name: "Chaux", current_quantity: "40.000" },
          { ...mercury, is_refining_material: true },
        ]);
      }),
    );
    openAt("/fr/inventory/projects/3");

    const headings = await screen.findAllByRole("heading", { level: 2 });
    expect(headings.map((heading) => heading.textContent)).toEqual(["Mercure", "Chaux"]);
    expect(askedProject).toBe("3");

    const card = cardOf("Mercure");
    expect(card.getByText("8,5")).toBeVisible();
    expect(card.getByText(text.material.hint)).toBeVisible();
    expect(card.getByRole("link", { name: text.open })).toHaveAttribute(
      "href",
      "/fr/inventory/resources/2",
    );
    expect(cardOf("Chaux").getByRole("link", { name: text.open })).toHaveAttribute(
      "href",
      "/fr/inventory/resources/6",
    );
    expect(screen.getByRole("link", { name: text.new })).toHaveAttribute(
      "href",
      "/fr/inventory/projects/3?new=resource",
    );
  });

  it("offers to set up the mercury when the project has none", async () => {
    server.use(http.get(`${API}/resources/`, () => page([{ ...mercury, id: 6, name: "Chaux" }])));
    openAt("/fr/inventory/projects/3");

    const card = await findCardOf(text.kinds.mercury);
    expect(card.getByText(text.material.missing)).toBeVisible();
    expect(card.getByRole("link", { name: new RegExp(text.material.setUp) })).toHaveAttribute(
      "href",
      "/fr/inventory/projects/3?new=material",
    );
  });

  it("prepares the mercury when setting it up, leaving its quantity to type", async () => {
    server.use(http.get(`${API}/resources/`, () => page([])));
    openAt("/fr/inventory/projects/3?new=material");

    const dialog = within(await screen.findByRole("dialog", { name: text.material.setUp }));
    expect(dialog.getByLabelText(text.fields.kind)).toHaveValue("mercury");
    expect(dialog.queryByLabelText(text.fields.name)).toBeNull();
    expect(dialog.getByLabelText(text.fields.initialQuantity)).toHaveValue(null);
  });

  it("keeps the add button and explains a refused list", async () => {
    server.use(http.get(`${API}/resources/`, () => new HttpResponse(null, { status: 403 })));
    openAt("/fr/inventory/projects/3");

    const alert = await screen.findByRole("alert");

    expect(alert).toHaveTextContent(messages.errors.forbidden.description);
    expect(alert).toHaveTextContent("Code d'erreur : 403");
    expect(screen.getByRole("link", { name: text.new })).toBeVisible();
  });
});

describe("ResourceScreen", () => {
  it("shows the resource's quantities, its actions and every column of its history", async () => {
    openAt("/fr/inventory/resources/2");

    expect(await screen.findByRole("heading", { name: "Mercure" })).toBeVisible();
    expect(screen.getByRole("link", { name: new RegExp(text.decrease) })).toHaveAttribute(
      "href",
      "/fr/inventory/resources/2?action=decrease",
    );
    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      text.fields.changedAt,
      text.fields.changeType,
      text.fields.quantity,
      text.fields.quantityBefore,
      text.fields.quantityAfter,
      text.fields.shipment,
      text.fields.note,
      text.fields.changedBy,
    ]);
    expect(cellsOf(screen.getAllByRole("row")[1])).toEqual([
      "12/10/2026 11:00",
      text.refiningChangeTypes.decrease,
      "1,5",
      "10",
      "8,5",
      "SH-4",
      "Lot 4",
      "Aicha",
    ]);
  });

  it("shows a view-only role the resource and its history with no way to change it", async () => {
    openAt("/fr/inventory/resources/2?action=increase", {
      superuser: false,
      rights: rightsFromApi([{ module: "inventory", can_view: true }]),
    });

    expect(await screen.findByRole("heading", { name: "Mercure" })).toBeVisible();
    expect(cellsOf(screen.getAllByRole("row")[1])[1]).toBe(text.refiningChangeTypes.decrease);
    expect(screen.queryByRole("link", { name: new RegExp(text.increase) })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: new RegExp(text.decrease) })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("offers the project's refining operations when decreasing", async () => {
    let askedProject: string | null = null;
    server.use(
      http.get(`${API}/refining-operations/`, ({ request }) => {
        askedProject = new URL(request.url).searchParams.get("project");
        return page([
          {
            id: 5,
            shipment_number: "SH-4",
            customer_name: "Sidi",
            grinder_code: "P3-2",
            project_name: "Zouérat 1",
            worker_name: "Aicha",
            refining_date: "2026-10-12T09:30:00Z",
            weight_before: "120.000",
            weight_after: "118.000",
            weight_loss: "2.000",
            gold_weight: "14.000",
            loss_reason: "",
            notes: "",
            created_at: "2026-10-12T10:00:00Z",
            updated_at: "2026-10-12T10:00:00Z",
          },
        ]);
      }),
    );
    openAt("/fr/inventory/resources/2?action=decrease");

    const dialog = within(await screen.findByRole("dialog", { name: "Diminuer Mercure" }));

    expect(
      within(dialog.getByLabelText(text.fields.refiningOperation))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([text.form.noRefiningOperation, "SH-4 · Sidi · 12/10/2026"]);
    expect(askedProject).toBe("3");
  });

  it("answers not found for an unknown resource", async () => {
    server.use(http.get(`${API}/resources/9/`, () => new HttpResponse(null, { status: 404 })));
    openAt("/fr/inventory/resources/9");

    expect(await screen.findByText(/404/)).toBeVisible();
  });
});
