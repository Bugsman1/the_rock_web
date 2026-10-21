import { screen, waitFor, within } from "@testing-library/react";
import { http } from "msw";
import { describe, expect, it } from "vitest";
import { rightsFromApi } from "@/lib/access";
import { formatMoney } from "@/lib/format";
import messages from "@/messages/fr.json";
import {
  API,
  apiShipment,
  cellsOf,
  openAt,
  page,
  server,
  serveSettlements,
  text,
} from "./settlementsTesting";

serveSettlements();

function panel(title: string) {
  const section = screen.getByRole("heading", { name: title }).closest("section");

  if (section === null) {
    throw new Error(`no panel ${title}`);
  }

  return within(section);
}

function answerShipments() {
  server.use(
    http.get(`${API}/shipments/`, () =>
      page([apiShipment(1, "completed"), apiShipment(3, "completed"), apiShipment(6, "grinding")]),
    ),
  );
}

describe("SettlementProjectScreen", () => {
  it("lists the project's finished shipments not settled yet, each ready to settle", async () => {
    answerShipments();
    openAt("/fr/settlements/projects/3");

    expect(await screen.findByText(text.project.waitingTitle)).toBeVisible();
    const waiting = panel(text.project.waitingTitle);
    const [, row] = waiting.getAllByRole("row");
    expect(cellsOf(row)).toEqual([
      "SHP-00003",
      "Ahmed",
      "+222 22 41 18 30",
      "03/10/2026",
      "10,5",
      formatMoney(1050, "fr"),
      formatMoney(0, "fr"),
      text.project.settle,
    ]);
    expect(waiting.getByRole("link", { name: /Ahmed/ })).toHaveAttribute(
      "href",
      "/fr/settlements/new?customer=7&project=3",
    );
    expect(waiting.queryByText("SHP-00001")).not.toBeInTheDocument();
    expect(waiting.queryByText("SHP-00006")).not.toBeInTheDocument();
  });

  it("lists the project's settlements and searches them by number on the server", async () => {
    let requested: URL | undefined;
    server.use(
      http.get(`${API}/settlements/`, ({ request }) => {
        requested = new URL(request.url);
        return page([]);
      }),
    );
    openAt("/fr/settlements/projects/3?q=STL-9");

    expect(await screen.findByText(text.noResults)).toBeVisible();
    await waitFor(() => {
      expect(requested?.searchParams.get("project")).toBe("3");
    });
  });

  it("says when no finished shipment waits in the project", async () => {
    openAt("/fr/settlements/projects/3");

    expect(await screen.findByText(text.project.waitingEmpty)).toBeVisible();
  });

  it("offers no settling to a role that can only view settlements", async () => {
    answerShipments();
    openAt("/fr/settlements/projects/3", {
      superuser: false,
      rights: rightsFromApi([{ module: "settlements", can_view: true }]),
    });

    expect(await screen.findByText("SHP-00003")).toBeVisible();
    expect(screen.queryByRole("link", { name: /Ahmed/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: new RegExp(text.new) })).not.toBeInTheDocument();
  });

  it("answers not found for an unknown project", async () => {
    openAt("/fr/settlements/projects/9");

    expect(await screen.findByText(/404/)).toBeVisible();
    expect(messages.errors.notFound.title).toBeTruthy();
  });
});
