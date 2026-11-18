import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/format";
import messages from "@/messages/fr.json";
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
  it("shows each project's income, expenses and net profit, each opening that project", async () => {
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
    expect(asked.profitLoss?.get("date__gte")).toBe("2026-11-01");
    expect(asked.profitLoss?.get("date__lte")).toBe("2026-11-30");
  });

  it("starts on the current month, without counting it as a filter", async () => {
    openAt("/fr/accounting");

    await screen.findByRole("heading", { name: title("Zouérat 1") });

    expect(asked.profitLoss?.get("date__gte")).toMatch(/^\d{4}-\d{2}-01$/);
    expect(screen.getByRole("button", { name: messages.filters.button })).toBeVisible();
  });

  it("counts a chosen period as one filter", async () => {
    openAt("/fr/accounting?from=2025-01-01&to=2025-01-31");

    await screen.findByRole("heading", { name: title("Zouérat 1") });

    expect(screen.getByRole("button", { name: `${messages.filters.button}1` })).toBeVisible();
  });

  it("opens the only project of a user who sees one", async () => {
    server.use(http.get(`${API}/projects/`, () => page([project(3, "Zouérat 1")])));
    openAt(`/fr/accounting?${period}`);

    expect(await screen.findByRole("heading", { name: text.summary })).toBeVisible();
    expect(asked.summary?.get("project")).toBe("3");
    expect(screen.queryByRole("link", { name: common.back })).toBeNull();
  });
});

describe("AccountingProjectScreen", () => {
  it("shows the project's summary, then tabs opening on the movements to approve", async () => {
    const user = userEvent.setup();
    openAt(`/fr/accounting/projects/3?${period}`);

    const summary = await screen.findByRole("heading", { name: text.summary });
    const summaryPanel = within(summary.closest("section") ?? document.body);
    const [, row] = summaryPanel.getAllByRole("row");
    expect(
      within(row ?? document.body)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(
      [90000, 20000, 70000]
        .map((amount) => formatMoney(amount, "fr"))
        .concat(
          [60000, 5000].map((amount) => formatMoney(amount, "fr")),
          "2",
        ),
    );

    expect(screen.getByRole("tab", { name: text.approval.title })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("heading", { name: text.approval.title })).toBeVisible();
    expect(screen.queryByRole("heading", { name: text.profitLoss.expenseTitle })).toBeNull();

    await user.click(screen.getByRole("tab", { name: text.tabs.profitLoss }));
    expect(screen.queryByRole("heading", { name: text.approval.title })).toBeNull();
    const expenses = within(
      screen.getByRole("heading", { name: text.profitLoss.expenseTitle }).closest("section") ??
        document.body,
    );
    expect(expenses.getByText("Camions")).toBeVisible();
    expect(expenses.getByRole("row", { name: /Total/ })).toHaveTextContent(money(20000));
    for (const report of ["summary", "profitLoss"]) {
      expect(asked[report]?.get("project")).toBe("3");
    }
    expect(screen.getByRole("link", { name: common.back })).toHaveAttribute(
      "href",
      `/fr/accounting?${period}`,
    );
  });
});
