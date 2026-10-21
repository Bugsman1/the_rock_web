import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import {
  API,
  apiSettlement,
  apiShipment,
  openAt,
  page,
  server,
  serveSettlements,
  text,
} from "./settlementsTesting";

serveSettlements();

const select = (number: string) =>
  screen.getByLabelText(text.form.select.replace("{number}", number));

function answerShipments(shipments: readonly object[]) {
  server.use(http.get(`${API}/shipments/`, () => page(shipments)));
}

describe("NewSettlementScreen", () => {
  it("lists the chosen customer's fully ground and refined shipments not settled yet", async () => {
    answerShipments([
      apiShipment(1, "completed"),
      apiShipment(3, "completed"),
      apiShipment(6, "grinding"),
      { ...apiShipment(8, "refining"), is_ground: true },
    ]);
    const router = openAt("/fr/settlements/new");
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText(text.fields.customer), "Ahm");
    await user.click(await screen.findByRole("option", { name: /Ahmed/ }));

    expect(await screen.findByText("SHP-00003")).toBeVisible();
    expect(router.state.location.search).toBe("?customer=7");
    expect(screen.queryByText("SHP-00001")).not.toBeInTheDocument();
    expect(select("SHP-00003")).toBeChecked();
    expect(screen.queryByText("SHP-00006")).not.toBeInTheDocument();
    expect(screen.queryByText("SHP-00008")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(text.fields.project)).not.toBeInTheDocument();
  });

  it("saves the settlement and opens its page", async () => {
    answerShipments([apiShipment(3, "completed")]);
    let sent: unknown;
    server.use(
      http.post(`${API}/settlements/`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ ...apiSettlement, id: 9 }, { status: 201 });
      }),
      http.get(`${API}/settlements/9/`, () =>
        HttpResponse.json({ ...apiSettlement, id: 9, number: "STL-2026-00009" }),
      ),
    );
    const router = openAt("/fr/settlements/new?customer=7");
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText(text.fields.grindingCostPerBag), "250");
    await user.click(screen.getByRole("button", { name: text.form.submit }));

    expect(
      await screen.findByRole("heading", {
        name: text.detail.title.replace("{number}", "STL-2026-00009"),
      }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe("/fr/settlements/9");
    expect(sent).toEqual({
      customer: 7,
      shipments: [3],
      grinding_cost_per_bag: "250",
      refining_cost_per_gram: "0",
      debt: "0",
      debt_description: "",
    });
  });

  it("asks the project first when the customer has shipments to settle in two", async () => {
    answerShipments([apiShipment(3, "completed"), apiShipment(5, "completed", 5)]);
    const router = openAt("/fr/settlements/new?customer=7");
    const user = userEvent.setup();

    const project = await screen.findByLabelText(text.fields.project);
    expect(screen.queryByRole("button", { name: text.form.submit })).not.toBeInTheDocument();

    await user.selectOptions(project, "5");

    expect(await screen.findByText("SHP-00005")).toBeVisible();
    expect(screen.queryByText("SHP-00003")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(router.state.location.search).toBe("?customer=7&project=5");
    });
  });

  it("says when the customer has nothing left to settle", async () => {
    answerShipments([apiShipment(1, "completed"), apiShipment(6, "grinding")]);
    openAt("/fr/settlements/new?customer=7");

    expect(await screen.findByText(text.form.noShipments)).toBeVisible();
    expect(screen.queryByRole("button", { name: text.form.submit })).not.toBeInTheDocument();
  });

  it("keeps the project it was opened from once the customer is chosen", async () => {
    answerShipments([apiShipment(3, "completed")]);
    const router = openAt("/fr/settlements/new?project=3");
    const user = userEvent.setup();

    expect(await screen.findByRole("link", { name: /Retour/ })).toHaveAttribute(
      "href",
      "/fr/settlements/projects/3",
    );
    await user.type(screen.getByLabelText(text.fields.customer), "Ahm");
    await user.click(await screen.findByRole("option", { name: /Ahmed/ }));

    await waitFor(() => {
      expect(router.state.location.search).toBe("?customer=7&project=3");
    });
  });

  it("shows the customer it was opened for, with no customer search", async () => {
    answerShipments([apiShipment(3, "completed")]);
    openAt("/fr/settlements/new?customer=7&project=3");

    expect(await screen.findByText("SHP-00003")).toBeVisible();
    expect(screen.getByText(text.fields.customer).nextElementSibling).toHaveTextContent("Ahmed");
    expect(screen.queryByRole("combobox", { name: text.fields.customer })).not.toBeInTheDocument();
  });
});
