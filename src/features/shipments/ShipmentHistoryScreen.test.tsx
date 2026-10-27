import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { describe, expect, it } from "vitest";
import messages from "@/messages/fr.json";
import type { ShipmentRecord } from "@/lib/shipments";
import { ShipmentHistory } from "./ShipmentHistoryScreen";

const history = messages.shipments.history;

function record(
  shipmentNumber: string,
  customerName: string,
  arrivedAt: string,
  phone = "+222 22 41 18 30",
): ShipmentRecord {
  return {
    id: shipmentNumber,
    shipmentNumber,
    customerName,
    phone,
    arrivedAt,
    bagCount: 10,
    testBags: 0,
    project: "zouerate1",
    status: "completed",
    stage: "completed",
    source: "Chami",
    notes: "",
    transportTotal: 0,
    paid: 0,
    debt: 0,
  };
}

const records = [
  record("SH-1012", "Ahmed", "2026-09-08T09:30:00Z"),
  record("SH-1033", "Fatima", "2026-09-28T11:40:00Z", "+222 46 10 93 25"),
  record("SH-1052", "Mariem", "2026-10-06T16:45:00Z", "+222 36 52 11 07"),
  record("SH-1041", "Ahmed", "2026-10-02T08:15:00Z"),
  record("SH-1060", "Ahmed", "2026-10-09T08:15:00Z"),
];

function renderHistory(shown: readonly ShipmentRecord[] = records) {
  const router = createMemoryRouter(
    [{ path: "/fr/history", element: <ShipmentHistory records={shown} /> }],
    { initialEntries: ["/fr/history"] },
  );

  return render(
    <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
      <RouterProvider router={router} />
    </IntlProvider>,
  );
}

function shownShipments() {
  const [body] = within(screen.getByRole("table")).getAllByRole("rowgroup").slice(1);
  const rows = body === undefined ? [] : within(body).getAllByRole("row");

  return rows.map((row) => within(row).getAllByRole("cell")[0]?.textContent);
}

describe("ShipmentHistory", () => {
  it("lists every shipment of the project, newest first", () => {
    renderHistory();

    const shown = shownShipments();
    expect(shown).toHaveLength(records.length);
    expect(shown[0]).toBe("SH-1060");
    expect(screen.getByRole("status")).toHaveTextContent(String(records.length));
  });

  it("narrows the list to the typed date range", async () => {
    const user = userEvent.setup();
    renderHistory();

    await user.type(screen.getByLabelText(history.from), "01092026");
    await user.type(screen.getByLabelText(history.to), "15092026");

    expect(shownShipments()).toEqual(["SH-1012"]);
  });

  it("shows one client's shipments with how many shipments and bags they brought", async () => {
    const user = userEvent.setup();
    renderHistory();

    await user.type(screen.getByLabelText(history.columns.client), "ahm");
    await user.click(screen.getByRole("option", { name: /Ahmed/ }));

    expect(shownShipments()).toEqual(["SH-1060", "SH-1041", "SH-1012"]);
    expect(screen.getByRole("status")).toHaveTextContent(
      history.clientCount.replace("{shipments}", "3").replace("{bags}", "30"),
    );
  });

  it("combines the client and the dates, then clears both", async () => {
    const user = userEvent.setup();
    renderHistory();

    await user.type(screen.getByLabelText(history.columns.client), "ahm");
    await user.click(screen.getByRole("option", { name: /Ahmed/ }));
    await user.type(screen.getByLabelText(history.from), "01102026");

    expect(shownShipments()).toEqual(["SH-1060", "SH-1041"]);
    expect(screen.getByRole("status")).toHaveTextContent(
      history.clientCount.replace("{shipments}", "2").replace("{bags}", "20"),
    );

    await user.click(screen.getByRole("button", { name: history.clear }));

    expect(screen.getByLabelText(history.columns.client)).toHaveValue("");
    expect(shownShipments()).toHaveLength(records.length);
  });

  it("shows whether each shipment is fully paid and whether it has a debt", () => {
    renderHistory([
      { ...record("SH-1", "Ahmed", "2026-09-08T09:30:00Z"), transportTotal: 500, paid: 200 },
      {
        ...record("SH-2", "Sidi", "2026-09-09T09:30:00Z"),
        transportTotal: 500,
        paid: 500,
        debt: 300,
      },
    ]);

    const [, paid, unpaid] = screen.getAllByRole("row");
    expect(screen.getByText(messages.shipments.debt.badge)).toHaveAttribute(
      "title",
      expect.stringMatching(/300/),
    );
    expect(paid).toHaveTextContent(messages.shipments.debt.badge);
    expect(unpaid).not.toHaveTextContent(messages.shipments.debt.badge);
    expect(paid).toHaveTextContent("SH-2");
    expect(paid).toHaveTextContent(messages.shipments.payment.complete);
    expect(unpaid).toHaveTextContent("SH-1");
    expect(unpaid).toHaveTextContent(messages.shipments.payment.incomplete);
  });

  it("opens a shipment from its row", () => {
    renderHistory();

    expect(screen.getByRole("link", { name: "SH-1012" })).toHaveAttribute(
      "href",
      "/fr/shipments/SH-1012",
    );
  });

  it("says so when nothing matches", async () => {
    const user = userEvent.setup();
    renderHistory();

    await user.type(screen.getByLabelText(history.columns.client), "fat");
    await user.click(screen.getByRole("option", { name: /Fatima/ }));
    await user.type(screen.getByLabelText(history.from), "01102026");

    expect(screen.getByText(history.empty)).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows each shipment as completed or cancelled", () => {
    renderHistory([
      record("SH-1012", "Ahmed", "2026-09-08T09:30:00Z"),
      {
        ...record("SH-1070", "Fatima", "2026-10-10T08:00:00Z"),
        status: "cancelled",
        stage: "cancelled",
      },
    ]);

    const statuses = messages.shipments.statuses;
    expect(
      within(screen.getByRole("row", { name: /SH-1070/ })).getByText(statuses.cancelled),
    ).toBeVisible();
    expect(
      within(screen.getByRole("row", { name: /SH-1012/ })).getByText(statuses.completed),
    ).toBeVisible();
  });
});
