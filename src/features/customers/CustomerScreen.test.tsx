import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { noAccess, rightsFromApi } from "@/lib/access";
import type { Access } from "@/lib/access";
import { AccessContext } from "@/lib/accessContext";
import { formatDateTime, formatMoney } from "@/lib/format";
import messages from "@/messages/fr.json";
import { CustomerScreen, customerLoader } from "./CustomerScreen";

const API = `${window.location.origin}/api/v1`;
const server = setupServer();
const text = messages.customers.debts;
const allRights: Access = { ...noAccess, superuser: true };

const stamps = { created_at: "2026-10-01T08:00:00Z", updated_at: "2026-10-01T08:00:00Z" };

const openDebt = {
  id: 12,
  customer: 7,
  customer_name: "Ahmed",
  customer_phone: "+22222411830",
  description: "Avance en espèces",
  incurred_at: "2026-10-01T08:00:00Z",
  original_amount: "50000.00",
  increased_amount: "0.00",
  total_amount: "50000.00",
  paid_amount: "20000.00",
  remaining_amount: "30000.00",
  status: "partially_paid",
  approved_at: null,
  approved_by_name: null,
  increases: [],
  payments: [
    { id: 4, amount: "20000.00", paid_at: "2026-10-03T10:00:00Z", notes: "Premier versement" },
  ],
  created_by_name: "Sidi",
  ...stamps,
};

const paidDebt = {
  ...openDebt,
  id: 13,
  description: "Pièces",
  original_amount: "8000.00",
  total_amount: "8000.00",
  paid_amount: "8000.00",
  remaining_amount: "0.00",
  status: "paid",
  payments: [],
};

let posted: { path: string; body: unknown; key: string | null }[] = [];
let historyLoads = 0;

function recordPost(path: string) {
  return http.post(`${API}/${path}/`, async ({ request }) => {
    posted.push({
      path,
      body: await request.json(),
      key: request.headers.get("Idempotency-Key"),
    });
    return HttpResponse.json({}, { status: 201 });
  });
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  posted = [];
  historyLoads = 0;
  server.use(
    http.get(`${API}/customers/7/`, () =>
      HttpResponse.json({
        id: 7,
        full_name: "Ahmed",
        phone: "+22222411830",
        is_active: true,
        ...stamps,
      }),
    ),
    http.get(`${API}/customer-debts/`, () =>
      HttpResponse.json({ count: 2, results: [openDebt, paidDebt] }),
    ),
    http.get(`${API}/customer-debts/12/history/`, () => {
      historyLoads += 1;
      return HttpResponse.json([
        {
          type: "created",
          id: 12,
          date: "2026-10-01T08:00:00Z",
          amount: "50000.00",
          text: "Avance en espèces",
          created_by_name: "Sidi",
          recorded_at: "2026-10-01T08:00:00Z",
          balance: "50000.00",
        },
        {
          type: "payment",
          id: 4,
          date: "2026-10-03T10:00:00Z",
          amount: "20000.00",
          text: "Premier versement",
          created_by_name: "Aicha",
          recorded_at: "2026-10-03T10:00:00Z",
          balance: "30000.00",
        },
      ]);
    }),
    http.get(`${API}/customer-debts/13/history/`, () => HttpResponse.json([])),
    recordPost("customer-debts"),
    recordPost("debt-increases"),
    recordPost("debt-payments"),
  );
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function openAt(path: string, access: Access = allRights) {
  const router = createMemoryRouter(
    [{ path: "/:locale/customers/:customer", loader: customerLoader, element: <CustomerScreen /> }],
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

const money = (amount: number) => formatMoney(amount, "fr").replace(/\s/g, " ");

function actionLabel(action: "increase" | "decrease" | "payOff", debt: string) {
  return text.actions.label.replace("{action}", text.actions[action]).replace("{debt}", debt);
}

async function openedDebt() {
  return within(await screen.findByRole("dialog", { name: "Avance en espèces" }));
}

describe("CustomerScreen", () => {
  it("shows the client and each debt with its amounts, status and actions", async () => {
    openAt("/fr/customers/7");

    expect(await screen.findByRole("heading", { name: "Ahmed" })).toBeVisible();
    const row = screen.getByRole("link", { name: "Avance en espèces" }).closest("tr");
    if (row === null) throw new Error("no debt row");

    expect(row).toHaveTextContent(money(50000));
    expect(row).toHaveTextContent(money(20000));
    expect(row).toHaveTextContent(money(30000));
    expect(row).toHaveTextContent(text.status.partially_paid);
    expect(row).toHaveTextContent(formatDateTime("2026-10-01T08:00:00Z", "fr"));
    expect(screen.getByRole("columnheader", { name: text.columns.actions })).toBeVisible();
    expect(screen.getByRole("link", { name: "Avance en espèces" })).toHaveAttribute(
      "href",
      "/fr/customers/7?debt=12",
    );
    expect(
      screen.getByRole("link", { name: actionLabel("payOff", "Avance en espèces") }),
    ).toHaveAttribute("href", "/fr/customers/7?debt=12&action=payOff");
  });

  it("opens a debt's history from its row, with the balance after each line", async () => {
    openAt("/fr/customers/7?debt=12");
    const dialog = await openedDebt();

    expect(dialog.getByText(text.history.created)).toBeVisible();
    const payment = dialog.getByText("Premier versement").closest("tr");
    if (payment === null) throw new Error("no payment line");

    expect(payment).toHaveTextContent(`−${money(20000)}`);
    expect(payment).toHaveTextContent(money(30000));
    expect(dialog.queryByText("Aicha")).not.toBeInTheDocument();
  });

  it("increases a debt from its row, sent once under its own key, then closes", async () => {
    const user = userEvent.setup();
    openAt("/fr/customers/7");

    await user.click(
      await screen.findByRole("link", { name: actionLabel("increase", "Avance en espèces") }),
    );
    const dialog = within(await screen.findByRole("dialog", { name: text.form.increaseTitle }));
    await user.type(dialog.getByLabelText(text.form.amount, { exact: false }), "5000");
    await user.type(dialog.getByLabelText(text.form.reason, { exact: false }), "Gasoil");
    await user.click(dialog.getByRole("button", { name: text.form.increase }));

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({
      path: "debt-increases",
      body: { debt: 12, amount: "5000", reason: "Gasoil" },
    });
    expect(posted[0]?.key).toMatch(/^[0-9a-f-]{36}$/);
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: text.form.increaseTitle }),
      ).not.toBeInTheDocument();
    });
    expect(historyLoads).toBe(0);
  });

  it("decreases a debt but never by more than what is left", async () => {
    const user = userEvent.setup();
    openAt("/fr/customers/7?debt=12&action=decrease");
    const dialog = within(await screen.findByRole("dialog", { name: text.form.decreaseTitle }));

    await user.type(dialog.getByLabelText(text.form.amount, { exact: false }), "30001");
    await user.click(dialog.getByRole("button", { name: text.form.decrease }));

    expect(
      await dialog.findByText(text.form.amountTooHigh.replace("{amount}", money(30000))),
    ).toBeVisible();
    expect(posted).toHaveLength(0);

    await user.clear(dialog.getByLabelText(text.form.amount, { exact: false }));
    await user.type(dialog.getByLabelText(text.form.amount, { exact: false }), "10000");
    await user.type(dialog.getByLabelText(text.form.notes), "Deuxième versement");
    await user.click(dialog.getByRole("button", { name: text.form.decrease }));

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({
      path: "debt-payments",
      body: { debt: 12, amount: "10000", notes: "Deuxième versement" },
    });
  });

  it("records the whole remaining amount when the debt is paid in full", async () => {
    const user = userEvent.setup();
    openAt("/fr/customers/7?debt=12&action=payOff");
    const dialog = within(await screen.findByRole("dialog", { name: text.form.payOffTitle }));

    expect(dialog.getByText(money(30000))).toBeVisible();
    await user.type(dialog.getByLabelText(text.form.notes), "Soldé en espèces");
    await user.click(dialog.getByRole("button", { name: text.form.payOff }));

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({
      path: "debt-payments",
      body: { debt: 12, amount: "30000", notes: "Soldé en espèces" },
    });
  });

  it("offers only an increase on a debt that is fully paid", async () => {
    openAt("/fr/customers/7?debt=13&action=decrease");

    expect(
      await screen.findByRole("link", { name: actionLabel("increase", "Pièces") }),
    ).toBeVisible();
    expect(screen.queryByRole("link", { name: actionLabel("decrease", "Pièces") })).toBeNull();
    expect(screen.queryByRole("link", { name: actionLabel("payOff", "Pièces") })).toBeNull();
    expect(screen.queryByRole("dialog", { name: text.form.decreaseTitle })).not.toBeInTheDocument();
  });

  it("adds a debt with its amount first, then its note", async () => {
    const user = userEvent.setup();
    openAt("/fr/customers/7?new=1");
    const dialog = within(await screen.findByRole("dialog", { name: text.form.newTitle }));

    expect(
      dialog
        .getByLabelText(text.form.amount, { exact: false })
        .compareDocumentPosition(dialog.getByLabelText(text.form.description, { exact: false })),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    await user.click(dialog.getByRole("button", { name: text.form.create }));
    expect(await dialog.findByText(messages.common.validation.required)).toBeVisible();

    await user.type(dialog.getByLabelText(text.form.description, { exact: false }), "Gasoil");
    await user.type(dialog.getByLabelText(text.form.amount, { exact: false }), "12000");
    await user.click(dialog.getByRole("button", { name: text.form.create }));

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({
      path: "customer-debts",
      body: { customer: 7, description: "Gasoil", original_amount: "12000" },
    });
  });

  it("shows a view-only role the debts with no way to change them", async () => {
    openAt("/fr/customers/7?debt=12", {
      userId: "",
      superuser: false,
      rights: rightsFromApi([
        { module: "customers", can_view: true },
        { module: "debts", can_view: true },
      ]),
    });

    expect(await openedDebt()).toBeTruthy();
    expect(
      screen.queryByRole("link", { name: actionLabel("increase", "Avance en espèces") }),
    ).toBeNull();
    expect(screen.queryByRole("link", { name: text.add })).toBeNull();
  });
});
