import { screen, within } from "@testing-library/react";
import { http } from "msw";
import { describe, expect, it } from "vitest";
import messages from "@/messages/fr.json";
import {
  API,
  apiShipment,
  openAt,
  page,
  projects,
  server,
  serveSettlements,
  text,
} from "./settlementsTesting";

serveSettlements();

function card(name: string) {
  const section = screen
    .getByRole("heading", { name: messages.common.projectTitle.replace("{name}", name) })
    .closest("section");

  if (section === null) {
    throw new Error(`no card for ${name}`);
  }

  return within(section);
}

describe("SettlementsScreen", () => {
  it("shows one card per project with its finished shipments to settle and its settlements", async () => {
    server.use(
      http.get(`${API}/shipments/`, () =>
        page([
          apiShipment(1, "completed"),
          apiShipment(2, "completed"),
          apiShipment(3, "completed"),
          apiShipment(5, "completed", 5),
          apiShipment(6, "grinding"),
        ]),
      ),
    );
    openAt("/fr/settlements");

    expect(await screen.findByRole("heading", { name: text.title })).toBeVisible();
    expect(card("Zouérat 1").getByText(text.overview.waiting).nextSibling).toHaveTextContent("1");
    expect(card("Zouérat 1").getByText(text.overview.settled).nextSibling).toHaveTextContent("1");
    expect(card("Sfariyat 1").getByText(text.overview.waiting).nextSibling).toHaveTextContent("1");
    expect(card("Sfariyat 1").getByText(text.overview.settled).nextSibling).toHaveTextContent("0");
    expect(card("Sfariyat 1").getByRole("link")).toHaveAttribute(
      "href",
      "/fr/settlements/projects/5",
    );
  });

  it("goes straight to the only project of a user who sees one", async () => {
    server.use(http.get(`${API}/projects/`, () => page([projects[0] ?? {}])));
    const router = openAt("/fr/settlements");

    expect(await screen.findByText(text.project.waitingTitle)).toBeVisible();
    expect(router.state.location.pathname).toBe("/fr/settlements/projects/3");
  });
});
