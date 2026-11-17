import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/format";
import {
  API,
  common,
  openAt,
  page,
  project,
  serveAccounting,
  server,
  text,
} from "./accountingTesting";
import type { Asked } from "./accountingTesting";

const asked: Asked = {};
serveAccounting(asked);

const money = (amount: number) => formatMoney(amount, "fr").replace(/\s/g, " ");
const title = (name: string) => common.projectTitle.replace("{name}", name);
const period = "from=2026-11-01&to=2026-11-30";

function cardOf(name: string) {
  const card = screen.getByRole("heading", { name: title(name) }).closest("section");

  if (card === null) {
    throw new Error(`no card ${name}`);
  }

  return within(card);
}

describe("AccountingScreen", () => {
  it("shows each project's approved income, expenses and net profit, each opening that project", async () => {
    openAt(`/fr/accounting?${period}`);

    await screen.findByRole("heading", { name: title("Zouérat 1") });

    expect(cardOf("Zouérat 1").getByText(text.netProfit).nextElementSibling).toHaveTextContent(
      money(70000),
    );
    expect(cardOf("Sfariyat 1").getByText(text.netProfit).nextElementSibling).toHaveTextContent(
      money(-3000),
    );
    expect(cardOf("Zouérat 1").getByRole("link", { name: common.openProject })).toHaveAttribute(
      "href",
      `/fr/accounting/projects/3?${period}`,
    );
    expect(asked.profitLoss?.get("approved")).toBe("true");
    expect(asked.profitLoss?.get("date__gte")).toBe("2026-11-01");
    expect(asked.profitLoss?.get("date__lte")).toBe("2026-11-30");
  });

  it("starts on the current month", async () => {
    openAt("/fr/accounting");

    await screen.findByRole("heading", { name: title("Zouérat 1") });

    expect(asked.profitLoss?.get("date__gte")).toMatch(/^\d{4}-\d{2}-01$/);
  });

  it("opens the only project of a user who sees one", async () => {
    server.use(http.get(`${API}/projects/`, () => page([project(3, "Zouérat 1")])));
    openAt(`/fr/accounting?${period}`);

    expect(await screen.findByRole("tab", { name: text.tabs.profitLoss })).toBeVisible();
    expect(asked.summary?.get("project")).toBe("3");
    expect(screen.queryByRole("link", { name: common.back })).toBeNull();
  });
});

describe("AccountingProjectScreen", () => {
  it("shows the project's approved figures and its profit and loss", async () => {
    openAt(`/fr/accounting/projects/3?${period}`);

    expect(await screen.findByText(text.netProfit)).toBeVisible();
    expect(screen.getByText(text.netProfit).nextElementSibling).toHaveTextContent(money(70000));
    expect(screen.getByText(text.unapproved).nextElementSibling).toHaveTextContent("2");
    expect(screen.getByText("Camions")).toBeVisible();
    for (const report of ["summary", "profitLoss", "income", "expenses"]) {
      expect(asked[report]?.get("project")).toBe("3");
      expect(asked[report]?.get("approved")).toBe("true");
    }
    expect(screen.getByRole("link", { name: common.back })).toHaveAttribute(
      "href",
      `/fr/accounting?${period}`,
    );
  });

  it("groups the expenses the way the user picks", async () => {
    const user = userEvent.setup();
    const router = openAt(`/fr/accounting/projects/3?${period}`);

    await user.click(await screen.findByRole("tab", { name: text.tabs.expenses }));
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByText("Carburant")).toBeVisible();

    await user.selectOptions(within(panel).getByLabelText(text.grouped.groupBy), "supplier");

    await waitFor(() => expect(router.state.location.search).toBe(`?${period}&expenses=supplier`));
    await waitFor(() => expect(asked.expenses?.get("group_by")).toBe("supplier"));
  });
});
