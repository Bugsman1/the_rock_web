import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { describe, expect, it } from "vitest";
import messages from "@/messages/fr.json";
import { DataTable } from "./DataTable";
import type { DataColumn } from "./DataTable";

type Payment = { id: string; label: string; amount: number };

const payments: Payment[] = [
  { id: "1", label: "Versement 1", amount: 1000 },
  { id: "2", label: "Versement 2", amount: 1200 },
];

const columns: DataColumn<Payment>[] = [
  { key: "label", header: "Versement", rowLink: true, cell: (payment) => payment.label },
  { key: "amount", header: "Montant", align: "end", cell: (payment) => String(payment.amount) },
  { key: "action", header: "Action", hideHeader: true, interactive: true, cell: () => "Modifier" },
];

function show(table: ReactNode) {
  const router = createMemoryRouter([{ path: "/fr", element: table }], {
    initialEntries: ["/fr"],
  });

  render(
    <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
      <RouterProvider router={router} />
    </IntlProvider>,
  );
}

describe("DataTable", () => {
  it("shows a heading per column and a row per item, numbers at the end", () => {
    show(
      <DataTable columns={columns} rows={payments} rowKey={(payment) => payment.id} empty="Vide" />,
    );

    const headers = screen.getAllByRole("columnheader");
    expect(headers.map((header) => header.textContent)).toEqual(["Versement", "Montant", "Action"]);
    expect(within(headers[2] ?? document.body).getByText("Action")).toHaveClass("sr-only");
    expect(headers[1]).toHaveClass("text-end");

    const [, first] = screen.getAllByRole("row");
    expect(
      within(first ?? document.body)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["Versement 1", "1000", "Modifier"]);
  });

  it("says when there is nothing to show", () => {
    show(<DataTable columns={columns} rows={[]} rowKey={(payment) => payment.id} empty="Vide" />);

    expect(screen.getByText("Vide")).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("opens a row through its link, keeping other actions clickable", () => {
    show(
      <DataTable
        columns={columns}
        rows={payments}
        rowKey={(payment) => payment.id}
        empty="Vide"
        rowLink={(payment) => ({
          href: `/payments/${payment.id}`,
          label: `Ouvrir ${payment.label}`,
        })}
      />,
    );

    expect(screen.getByRole("link", { name: "Ouvrir Versement 2" })).toHaveAttribute(
      "href",
      "/fr/payments/2",
    );
    expect(screen.getAllByText("Modifier")[0]?.closest("td")).toHaveClass("relative", "z-10");
  });

  it("adds a total under the chosen column", () => {
    show(
      <DataTable
        columns={columns}
        rows={payments}
        rowKey={(payment) => payment.id}
        empty="Vide"
        total={{ label: "Total", column: "amount", value: "2200" }}
      />,
    );

    const total = screen.getAllByRole("rowgroup")[2];
    expect(total).toHaveTextContent("Total2200");
  });
});
