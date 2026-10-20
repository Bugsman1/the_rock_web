import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import messages from "@/messages/fr.json";
import {
  API,
  cardOf,
  cellsOf,
  findCardOf,
  initial,
  mercury,
  openAt,
  page,
  server,
  serveInventory,
  text,
} from "./inventoryTesting";

serveInventory();

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

  it("shows the project's mercury first, then water and fuel, and hides any other resource", async () => {
    let askedProject: string | null = null;
    server.use(
      http.get(`${API}/resources/`, ({ request }) => {
        askedProject = new URL(request.url).searchParams.get("project");
        return page([
          { ...mercury, id: 7, name: "Chaux" },
          { ...mercury, id: 6, name: "Water", current_quantity: "40.000" },
          { ...mercury, is_refining_material: true },
        ]);
      }),
    );
    openAt("/fr/inventory/projects/3");

    const headings = await screen.findAllByRole("heading", { level: 2 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      text.kinds.mercury,
      text.kinds.water,
    ]);
    expect(askedProject).toBe("3");

    const card = cardOf("Mercure");
    expect(card.getByText("8,5")).toBeVisible();
    expect(card.getByText(text.material.hint)).toBeVisible();
    expect(card.getByRole("link", { name: text.open })).toHaveAttribute(
      "href",
      "/fr/inventory/resources/2",
    );
    expect(cardOf(text.kinds.water).getByRole("link", { name: text.open })).toHaveAttribute(
      "href",
      "/fr/inventory/resources/6",
    );
    expect(screen.getByRole("link", { name: text.new })).toHaveAttribute(
      "href",
      "/fr/inventory/projects/3?new=resource",
    );
  });

  it("finds a resource of the project by its name", async () => {
    server.use(
      http.get(`${API}/resources/`, () =>
        page([
          { ...mercury, id: 6, name: "fuel" },
          { ...mercury, is_refining_material: true },
        ]),
      ),
    );
    const user = userEvent.setup();
    openAt("/fr/inventory/projects/3");

    const search = await screen.findByLabelText(
      messages.common.searchIn.replace("{list}", text.title),
    );
    await user.type(search, "ess");

    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual([text.kinds.fuel]);

    await user.clear(search);
    await user.type(search, "fer");
    expect(screen.getByText(messages.common.noMatch)).toBeVisible();
  });

  it("shows no mercury card until the mercury is added as a new resource", async () => {
    server.use(http.get(`${API}/resources/`, () => page([{ ...mercury, id: 6, name: "Water" }])));
    openAt("/fr/inventory/projects/3");

    await findCardOf(text.kinds.water);

    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual([text.kinds.water]);
    expect(screen.getByRole("link", { name: text.new })).toHaveAttribute(
      "href",
      "/fr/inventory/projects/3?new=resource",
    );
  });

  it("says the project has no resources yet, not that a search found nothing", async () => {
    server.use(http.get(`${API}/resources/`, () => page([{ ...mercury, id: 6, name: "Chaux" }])));
    openAt("/fr/inventory/projects/3");

    expect(await screen.findByText(text.empty)).toBeVisible();
    expect(screen.queryByText(messages.common.noMatch)).toBeNull();
  });

  it("keeps the add button and explains a refused list", async () => {
    server.use(http.get(`${API}/resources/`, () => new HttpResponse(null, { status: 403 })));
    openAt("/fr/inventory/projects/3");

    const alert = await screen.findByRole("alert");

    expect(alert).toHaveTextContent(messages.errors.forbidden.description);
    expect(alert).toHaveTextContent("Code d'erreur : 403");
    expect(screen.getByRole("link", { name: text.new })).toBeVisible();
  });

  it("offers no new resource once the project has mercury, water and fuel", async () => {
    server.use(
      http.get(`${API}/resources/`, () =>
        page([
          { ...mercury, is_refining_material: true },
          { ...mercury, id: 6, name: "Water" },
          { ...mercury, id: 7, name: "Fuel" },
        ]),
      ),
    );
    openAt("/fr/inventory/projects/3?new=resource");

    await findCardOf(text.kinds.fuel);

    expect(screen.queryByRole("link", { name: text.new })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the new resource's page, its history starting with the initial quantity", async () => {
    const water = { ...mercury, id: 6, name: "water", initial_quantity: "5.000" };
    server.use(
      http.post(`${API}/resources/`, () => HttpResponse.json(water, { status: 201 })),
      http.get(`${API}/resources/6/`, () => HttpResponse.json(water)),
      http.get(`${API}/resource-history/`, () =>
        page([{ ...initial, resource: 6, quantity: "5.000", quantity_after: "5.000" }]),
      ),
    );
    const user = userEvent.setup();
    openAt("/fr/inventory/projects/3?new=resource");

    const dialog = within(await screen.findByRole("dialog", { name: text.form.newTitle }));
    await user.selectOptions(dialog.getByLabelText(text.fields.kind), "water");
    await user.type(dialog.getByLabelText(text.fields.initialQuantity), "5");
    await user.click(dialog.getByRole("button", { name: text.form.create }));

    expect(await screen.findByRole("heading", { name: text.kinds.water })).toBeVisible();
    expect(screen.getAllByRole("row").slice(1).map(cellsOf)).toEqual([
      ["12/10/2026 08:00", text.changeTypes.initial, "5", "0", "5", "—", "—"],
    ]);
  });
});
