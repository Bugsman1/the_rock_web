import { screen, within } from "@testing-library/react";
import { http } from "msw";
import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/format";
import { API, common, openAt, page, project, serveCash, server, text } from "./cashTesting";
import type { Sent } from "./cashTesting";

const sent: Sent[] = [];
serveCash(sent);

const money = (amount: number) => formatMoney(amount, "fr").replace(/\s/g, " ");
const title = (name: string) => common.projectTitle.replace("{name}", name);

function cardOf(name: string) {
  const card = screen.getByRole("heading", { name: title(name) }).closest("section");

  if (card === null) {
    throw new Error(`no card ${name}`);
  }

  return within(card);
}

describe("CashScreen", () => {
  it("shows one card per project with its own money, each opening that project", async () => {
    openAt("/fr/cash");

    await screen.findByRole("heading", { name: title("Zouérat 1") });
    const zouerat = cardOf("Zouérat 1");
    const sfariyat = cardOf("Sfariyat 1");

    expect(zouerat.getByText(text.balances.balance).nextElementSibling).toHaveTextContent(
      money(1025000),
    );
    expect(zouerat.getByText(text.balances.capital).nextElementSibling).toHaveTextContent(
      money(1000000),
    );
    expect(sfariyat.getByText(text.balances.balance).nextElementSibling).toHaveTextContent(
      money(-2000),
    );
    expect(zouerat.getByRole("link", { name: common.openProject })).toHaveAttribute(
      "href",
      "/fr/cash/projects/3",
    );
    expect(screen.queryByText("Sidi Fournitures")).toBeNull();
  });

  it("opens the only project of a user who sees one, with no way back to the cards", async () => {
    server.use(http.get(`${API}/projects/`, () => page([project(3, "Zouérat 1", "zouerat")])));
    openAt("/fr/cash");

    expect(await screen.findByRole("heading", { name: title("Zouérat 1") })).toBeVisible();
    expect(await screen.findByText("Sidi Fournitures")).toBeVisible();
    expect(screen.queryByRole("link", { name: common.back })).toBeNull();
  });
});
