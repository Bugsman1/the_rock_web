import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { describe, expect, it } from "vitest";
import messages from "@/messages/fr.json";
import type { FilterFields } from "@/lib/filters";
import { FilterMenu, useFilters } from "./FilterMenu";
import { PageSlot } from "./PageSlot";

type Row = { name: string; client: string; paid: boolean };

const rows: readonly Row[] = [
  { name: "SH-1", client: "Ali", paid: true },
  { name: "SH-2", client: "Ali", paid: false },
  { name: "SH-3", client: "Sidi", paid: false },
];

const fields: FilterFields<Row> = {
  groups: [
    {
      key: "payment",
      options: [
        { value: "paid", matches: (row) => row.paid },
        { value: "unpaid", matches: (row) => !row.paid },
      ],
    },
  ],
  matchesClient: (row, client) => row.client === client,
};

const text = messages.filters;

function List() {
  const filters = useFilters(fields);

  return (
    <>
      <FilterMenu
        groups={[
          {
            key: "payment",
            label: "Paiement",
            options: [
              { value: "paid", label: "Payé" },
              { value: "unpaid", label: "Non payé" },
            ],
          },
        ]}
        {...filters.menu}
        clients={{
          options: [
            { value: "Ali", label: "Ali" },
            { value: "Sidi", label: "Sidi" },
          ],
        }}
      />
      <ul aria-label="rows">
        {rows.filter(filters.matches).map((row) => (
          <li key={row.name}>{row.name}</li>
        ))}
      </ul>
    </>
  );
}

function renderList() {
  const router = createMemoryRouter(
    [
      {
        path: "/fr/list",
        element: (
          <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
            <PageSlot>
              <List />
            </PageSlot>
          </IntlProvider>
        ),
      },
    ],
    { initialEntries: ["/fr/list?q=SH"] },
  );
  render(<RouterProvider router={router} />);

  return {
    router,
    user: userEvent.setup(),
    button: screen.getByRole("link", { name: text.button }),
  };
}

function shown() {
  return within(screen.getByRole("list", { name: "rows" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent);
}

const showResults = () => screen.getByRole("button", { name: text.show });

describe("FilterMenu", () => {
  it("opens the filters on their own page, in the address, with the list hidden", async () => {
    const { user, button, router } = renderList();
    expect(button).toHaveAttribute("href", "/fr/list?q=SH&filters=1");

    await user.click(button);

    expect(await screen.findByRole("heading", { name: text.button })).toBeVisible();
    expect(router.state.location.search).toBe("?q=SH&filters=1");
    expect(screen.queryByRole("list", { name: "rows" })).not.toBeInTheDocument();
  });

  it("goes back to the list unchanged from the back link", async () => {
    const { user, button, router } = renderList();
    await user.click(button);
    await user.click(await screen.findByRole("checkbox", { name: "Payé" }));
    await user.click(screen.getByRole("link", { name: messages.common.back }));

    expect(await screen.findByRole("list", { name: "rows" })).toBeVisible();
    expect(router.state.location.search).toBe("?q=SH");
    expect(shown()).toEqual(["SH-1", "SH-2", "SH-3"]);
  });

  it("shows the results of the stacked choices back on the list", async () => {
    const { user, button, router } = renderList();
    await user.click(button);

    const payment = within(await screen.findByRole("group", { name: "Paiement" }));
    await user.click(payment.getByRole("checkbox", { name: "Non payé" }));
    await user.type(screen.getByLabelText(text.client), "si");
    await user.click(screen.getByRole("option", { name: "Sidi" }));
    await user.click(showResults());

    expect(await screen.findByRole("list", { name: "rows" })).toBeVisible();
    expect(router.state.location.search).toBe("?q=SH");
    expect(shown()).toEqual(["SH-3"]);
    expect(screen.getByRole("link", { name: new RegExp(text.button) })).toHaveTextContent("2");
  });

  it("clears every choice, the client text included", async () => {
    const { user, button } = renderList();
    await user.click(button);
    await user.click(await screen.findByRole("checkbox", { name: "Payé" }));
    await user.type(screen.getByLabelText(text.client), "al");
    await user.click(screen.getByRole("option", { name: "Ali" }));
    await user.click(showResults());
    await screen.findByRole("list", { name: "rows" });
    expect(shown()).toEqual(["SH-1"]);

    await user.click(screen.getByRole("link", { name: new RegExp(text.button) }));
    await user.click(await screen.findByRole("button", { name: text.clear }));

    expect(screen.getByLabelText(text.client)).toHaveValue("");
    expect(screen.getByRole("checkbox", { name: "Payé" })).not.toBeChecked();
    expect(screen.queryByRole("button", { name: text.clear })).not.toBeInTheDocument();

    await user.click(showResults());
    await screen.findByRole("list", { name: "rows" });
    expect(shown()).toEqual(["SH-1", "SH-2", "SH-3"]);
  });

  it("opens again with the filters shown, the client included", async () => {
    const { user, button } = renderList();
    await user.click(button);
    await user.type(await screen.findByLabelText(text.client), "si");
    await user.click(screen.getByRole("option", { name: "Sidi" }));
    await user.click(showResults());
    await screen.findByRole("list", { name: "rows" });

    await user.click(screen.getByRole("link", { name: new RegExp(text.button) }));

    expect(await screen.findByLabelText(text.client)).toHaveValue("Sidi");
  });
});
