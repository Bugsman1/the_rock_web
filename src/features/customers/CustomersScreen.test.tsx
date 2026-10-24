import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { noAccess, rightsFromApi } from "@/lib/access";
import type { Access } from "@/lib/access";
import { AccessContext } from "@/lib/accessContext";
import { formatMoney } from "@/lib/format";
import messages from "@/messages/fr.json";
import { CustomersScreen, customersLoader } from "./CustomersScreen";

const allRights: Access = { ...noAccess, superuser: true };

const CUSTOMERS_URL = `${window.location.origin}/api/v1/customers/`;
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const apiCustomers = [
  { id: 1, full_name: "Ahmed", phone: "+222 22 41 18 30", debt_remaining: "40000.00" },
  { id: 2, full_name: "Fatima", phone: "+222 36 52 07 14", debt_remaining: "0.00" },
].map((customer) => ({
  ...customer,
  is_active: true,
  created_at: "2026-09-01T08:00:00Z",
  updated_at: "2026-09-01T08:00:00Z",
}));

function answerList(count: number, results: readonly object[], seen: URL[] = []) {
  server.use(
    http.get(CUSTOMERS_URL, ({ request }) => {
      seen.push(new URL(request.url));
      return HttpResponse.json({ count, results });
    }),
  );

  return seen;
}

function openAt(path: string, access: Access = allRights) {
  const router = createMemoryRouter(
    [{ path: "/fr/customers", loader: customersLoader, element: <CustomersScreen /> }],
    { initialEntries: [path] },
  );

  render(
    <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
      <AccessContext value={access}>
        <RouterProvider router={router} />
      </AccessContext>
    </IntlProvider>,
  );

  return router;
}

async function shownRows() {
  const table = await screen.findByRole("table");
  const [, ...rows] = within(table).getAllByRole("row");

  return rows;
}

async function shownNames() {
  return (await shownRows()).map((row) => within(row).getAllByRole("cell")[0]?.textContent);
}

describe("CustomersScreen", () => {
  it("opens no client page for a role that cannot see debts", async () => {
    answerList(2, apiCustomers);
    openAt("/fr/customers", {
      superuser: false,
      rights: rightsFromApi([{ module: "customers", can_view: true }]),
    });

    expect(await shownNames()).toEqual(["Ahmed", "Fatima"]);
    expect(screen.queryByRole("link", { name: "Ahmed" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: messages.customers.fields.debt }),
    ).not.toBeInTheDocument();
  });

  it("shows each customer's remaining debt from the backend", async () => {
    answerList(2, apiCustomers);
    openAt("/fr/customers");

    const [ahmed, fatima] = (await shownRows()).map((row) =>
      row.querySelector("td:nth-child(4)")?.textContent?.replace(/\s/g, " "),
    );

    expect(
      screen.getByRole("columnheader", { name: messages.customers.fields.debt }),
    ).toBeVisible();
    expect(ahmed).toBe(formatMoney(40000, "fr").replace(/\s/g, " "));
    expect(fatima).toBe("0");
  });

  it("lists the customers of the page with the total and an edit link that keeps the list", async () => {
    answerList(52, apiCustomers);
    openAt("/fr/customers?q=a&page=2");

    expect(await shownNames()).toEqual(["Ahmed", "Fatima"]);
    expect(screen.getByText("Clients : 52")).toBeVisible();
    expect(screen.getByRole("link", { name: "Ahmed" })).toHaveAttribute("href", "/fr/customers/1");
    expect(screen.getByRole("link", { name: "Modifier Fatima" })).toHaveAttribute(
      "href",
      "/fr/customers?q=a&page=2&edit=2",
    );
  });

  it("shows a view-only role the customers with no way to add or edit them", async () => {
    answerList(52, apiCustomers);
    openAt("/fr/customers?new=1", {
      superuser: false,
      rights: rightsFromApi([{ module: "customers", can_view: true }]),
    });

    expect(await shownNames()).toEqual(["Ahmed", "Fatima"]);
    expect(screen.queryByRole("link", { name: messages.customers.new })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Modifier Fatima" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Fatima" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("searches on the server once the user stops typing", async () => {
    const seen = answerList(2, apiCustomers);
    const user = userEvent.setup();
    const router = openAt("/fr/customers");

    await user.type(await screen.findByLabelText(messages.common.search), "fati");

    await waitFor(() => {
      expect(router.state.location.search).toBe("?q=fati");
    });
    expect(seen.at(-1)?.searchParams.get("search")).toBe("fati");
    expect(seen.filter((url) => url.searchParams.has("search"))).toHaveLength(1);
  });

  it("keeps the search field focused while the results follow the typing", async () => {
    answerList(2, apiCustomers);
    const user = userEvent.setup();
    const router = openAt("/fr/customers");
    const search = await screen.findByLabelText(messages.common.search);

    await user.type(search, "f");
    await waitFor(() => {
      expect(router.state.location.search).toBe("?q=f");
    });

    expect(screen.getByLabelText(messages.common.search)).toHaveFocus();
    await user.keyboard("ati");
    await waitFor(() => {
      expect(router.state.location.search).toBe("?q=fati");
    });
    expect(screen.getByLabelText(messages.common.search)).toHaveValue("fati");
    expect(screen.getByLabelText(messages.common.search)).toHaveFocus();
  });

  it("empties the search field when the list is opened again without a search", async () => {
    answerList(2, apiCustomers);
    const router = openAt("/fr/customers?q=fati");

    expect(await screen.findByLabelText(messages.common.search)).toHaveValue("fati");
    await act(() => router.navigate("/fr/customers"));

    expect(screen.getByLabelText(messages.common.search)).toHaveValue("");
  });

  it("links to the previous and next pages", async () => {
    answerList(52, apiCustomers);
    openAt("/fr/customers?q=a&page=2");

    expect(await screen.findByText("Page 2 sur 3")).toBeVisible();
    expect(screen.getByRole("link", { name: messages.common.previousPage })).toHaveAttribute(
      "href",
      "/fr/customers?q=a",
    );
    expect(screen.getByRole("link", { name: messages.common.nextPage })).toHaveAttribute(
      "href",
      "/fr/customers?q=a&page=3",
    );
  });

  it("hides the page links when everything fits on one page", async () => {
    answerList(2, apiCustomers);
    openAt("/fr/customers");

    await shownNames();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("says when a search finds nothing", async () => {
    answerList(0, []);
    openAt("/fr/customers?q=introuvable");

    expect(await screen.findByText(messages.customers.noResults)).toBeVisible();
  });

  it("says when there are no customers at all", async () => {
    answerList(0, []);
    openAt("/fr/customers");

    expect(await screen.findByText(messages.customers.empty)).toBeVisible();
  });

  it("opens the edit drawer with the customer and closes it back to the list", async () => {
    answerList(2, apiCustomers);
    server.use(http.get(`${CUSTOMERS_URL}2/`, () => HttpResponse.json(apiCustomers[1])));
    const user = userEvent.setup();
    const router = openAt("/fr/customers?q=a&edit=2");

    expect(
      await screen.findByRole("dialog", { name: messages.customers.form.title }),
    ).toBeVisible();
    expect(screen.getByLabelText(messages.customers.fields.name)).toHaveValue("Fatima");

    await user.click(screen.getByRole("button", { name: messages.common.cancel }));

    await waitFor(() => {
      expect(router.state.location.search).toBe("?q=a");
    });
  });

  it("adds a customer from the add drawer and shows the refreshed list", async () => {
    answerList(2, apiCustomers);
    let created: unknown;
    server.use(
      http.post(CUSTOMERS_URL, async ({ request }) => {
        created = await request.json();
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    const router = openAt("/fr/customers?new=1");

    const drawer = await screen.findByRole("dialog", { name: messages.customers.form.newTitle });
    await user.type(within(drawer).getByLabelText(messages.customers.fields.name), "Sidi");
    await user.type(within(drawer).getByLabelText(messages.customers.fields.phone), "46109325");
    answerList(0, []);
    await user.click(within(drawer).getByRole("button", { name: messages.customers.form.create }));

    await waitFor(() => {
      expect(router.state.location.search).toBe("");
    });
    expect(created).toEqual({ full_name: "Sidi", phone: "+22246109325" });
  });
});
