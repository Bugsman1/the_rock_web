import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "use-intl";
import { describe, expect, it } from "vitest";
import messages from "@/messages/fr.json";
import { noFilters } from "@/lib/filters";
import type { FilterFields } from "@/lib/filters";
import { FilterMenu, FilterSlot, FilterSlotTarget, useFilters } from "./FilterMenu";

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
    <FilterSlot>
      <header>
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
      </header>
      <FilterSlotTarget />
      <ul aria-label="rows">
        {rows.filter(filters.matches).map((row) => (
          <li key={row.name}>{row.name}</li>
        ))}
      </ul>
    </FilterSlot>
  );
}

function renderList() {
  render(
    <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
      <List />
    </IntlProvider>,
  );

  return { user: userEvent.setup(), button: screen.getByRole("button", { name: text.button }) };
}

function shown() {
  return within(screen.getByRole("list", { name: "rows" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent);
}

const card = () => screen.getByRole("region", { name: text.button });
const showResults = () => screen.getByRole("button", { name: text.show });

async function pick(user: ReturnType<typeof userEvent.setup>, group: string, choice: string) {
  await user.click(screen.getByRole("button", { name: group }));
  await user.click(screen.getByRole("checkbox", { name: choice }));
}

describe("FilterMenu", () => {
  it("opens a card above the list, out of the button's header, with the list still shown", async () => {
    const { user, button } = renderList();
    expect(screen.queryByRole("region", { name: text.button })).not.toBeInTheDocument();

    await user.click(button);

    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(within(screen.getByRole("banner")).queryByRole("region")).toBeNull();
    expect(card().compareDocumentPosition(screen.getByRole("list", { name: "rows" }))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(shown()).toEqual(["SH-1", "SH-2", "SH-3"]);
  });

  it("shows every group as a dropdown starting on all", async () => {
    const { user, button } = renderList();
    await user.click(button);

    const payment = screen.getByRole("button", { name: "Paiement" });
    expect(payment).toHaveTextContent(text.all);

    await pick(user, "Paiement", "Payé");
    await user.click(screen.getByRole("checkbox", { name: "Non payé" }));

    expect(payment).toHaveTextContent("Payé, Non payé");
  });

  it("filters the list below once asked, the choices stacked, and keeps the card open", async () => {
    const { user, button } = renderList();
    await user.click(button);

    await pick(user, "Paiement", "Non payé");
    await user.type(screen.getByLabelText(text.client), "si");
    await user.click(screen.getByRole("option", { name: "Sidi" }));
    expect(shown()).toEqual(["SH-1", "SH-2", "SH-3"]);

    await user.click(showResults());

    expect(shown()).toEqual(["SH-3"]);
    expect(card()).toBeVisible();
    expect(button).toHaveTextContent("2");
  });

  it("closes the card without changing the list", async () => {
    const { user, button } = renderList();
    await user.click(button);
    await pick(user, "Paiement", "Payé");

    await user.click(within(card()).getByRole("button", { name: messages.common.close }));

    expect(screen.queryByRole("region", { name: text.button })).not.toBeInTheDocument();
    expect(shown()).toEqual(["SH-1", "SH-2", "SH-3"]);
  });

  it("clears every choice, the client text included, and shows the first list again", async () => {
    const { user, button } = renderList();
    await user.click(button);
    await pick(user, "Paiement", "Payé");
    await user.type(screen.getByLabelText(text.client), "al");
    await user.click(screen.getByRole("option", { name: "Ali" }));
    await user.click(showResults());
    expect(shown()).toEqual(["SH-1"]);

    await user.click(screen.getByRole("button", { name: text.clear }));

    expect(screen.getByLabelText(text.client)).toHaveValue("");
    expect(screen.getByRole("button", { name: "Paiement" })).toHaveTextContent(text.all);
    expect(screen.queryByRole("button", { name: text.clear })).not.toBeInTheDocument();
    expect(shown()).toEqual(["SH-1", "SH-2", "SH-3"]);
  });

  it("shows it is loading until the results are in", async () => {
    let finish: () => void = () => undefined;
    const user = userEvent.setup();
    render(
      <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
        <FilterMenu
          groups={[]}
          state={noFilters}
          onApply={() =>
            new Promise<void>((resolve) => {
              finish = () => resolve();
            })
          }
        />
      </IntlProvider>,
    );

    await user.click(screen.getByRole("button", { name: text.button }));
    await user.click(showResults());

    expect(screen.getByRole("status", { name: messages.common.loading })).toBeVisible();
    expect(screen.queryByRole("button", { name: text.show })).not.toBeInTheDocument();

    finish();

    expect(await screen.findByRole("button", { name: text.show })).toBeVisible();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("opens again with the filters shown, the client included", async () => {
    const { user, button } = renderList();
    await user.click(button);
    await user.type(screen.getByLabelText(text.client), "si");
    await user.click(screen.getByRole("option", { name: "Sidi" }));
    await user.click(showResults());
    await user.click(button);

    await user.click(button);

    expect(screen.getByLabelText(text.client)).toHaveValue("Sidi");
  });
});
