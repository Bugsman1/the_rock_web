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
  const asked: URLSearchParams[] = [];
  server.use(
    http.get(`${API}/shipments/`, ({ request }) => {
      asked.push(new URL(request.url).searchParams);
      return page([apiShipment(3, "completed")]);
    }),
  );

  return asked;
}

describe("SettlementProjectScreen", () => {
  it("asks the backend for the project's shipments a settlement can take, oldest first", async () => {
    const asked = answerShipments();
    openAt("/fr/settlements/projects/3");

    expect(await screen.findByText("SHP-00003")).toBeVisible();
    expect(asked).toHaveLength(1);
    expect(asked[0]?.get("project")).toBe("3");
    expect(asked[0]?.get("settleable")).toBe("true");
    expect(asked[0]?.get("ordering")).toBe("arrival_date");
    expect(asked[0]?.has("status__in")).toBe(false);
  });

  it("lists the shipments to settle, each ready to settle", async () => {
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
      userId: "",
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
