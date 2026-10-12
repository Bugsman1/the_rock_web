import { render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import messages from "@/messages/fr.json";
import { RefiningScreen, refiningLoader } from "./RefiningScreen";

const API = `${window.location.origin}/api/v1`;
const server = setupServer();
const text = messages.refining;

const stamps = {
  is_active: true,
  created_at: "2026-10-01T08:00:00Z",
  updated_at: "2026-10-01T08:00:00Z",
};

const page = (results: readonly object[]) => HttpResponse.json({ count: results.length, results });

const grinding = (id: number, shipment: string, code: string, endTime: string | null) => ({
  id,
  shipment_number: shipment,
  customer_name: `Client ${shipment}`,
  grinder_code: code,
  project_name: "Zouérat 1",
  bags_count: 4,
  start_time: "2026-10-05T06:00:00Z",
  end_time: endTime,
  operator_name: "Ahmed",
  grinding_cost: "60000",
  notes: "",
  created_at: "2026-10-05T06:00:00Z",
  updated_at: "2026-10-05T06:00:00Z",
});

const refined = {
  id: 9,
  shipment_number: "SH-3",
  customer_name: "Client SH-3",
  grinder_code: "P3-2",
  project_name: "Zouérat 1",
  worker_name: "Aicha",
  bags_count: 4,
  refining_date: "2026-10-07T09:30:00Z",
  weight_before: "120.500",
  weight_after: "118.250",
  weight_loss: "2.250",
  gold_weight: "14.300",
  gold_weight_with_mercury: "20.000",
  gold_weight_without_mercury: "14.300",
  loss: "0.500",
  loss_reason: "arghawa",
  notes: "",
  created_at: "2026-10-07T10:00:00Z",
  updated_at: "2026-10-07T10:00:00Z",
};

const user = (id: number, name: string, project: number) => ({
  id,
  email: `${id}@mills.mr`,
  full_name: name,
  phone: "",
  role: 2,
  project,
  is_active: true,
});

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  server.use(
    http.get(`${API}/projects/`, () =>
      page([{ id: 3, name: "Zouérat 1", site: "zouerat", status: "active", ...stamps }]),
    ),
    http.get(`${API}/grinding-operations/`, () =>
      page([
        grinding(1, "SH-1", "P3-1", null),
        grinding(2, "SH-2", "P3-2", "2026-10-05T18:00:00Z"),
        grinding(3, "SH-3", "P3-2", "2026-10-05T18:00:00Z"),
      ]),
    ),
    http.get(`${API}/refining-operations/`, () => page([refined])),
    http.get(`${API}/roles/`, () =>
      page([
        { id: 1, name: "manager", permissions: [] },
        { id: 2, name: "supervisor", permissions: [] },
      ]),
    ),
    http.get(`${API}/users/`, () => page([user(4, "Aicha", 3), user(5, "Omar", 9)])),
    http.get(`${API}/resources/`, () =>
      page([
        {
          id: 7,
          project: 3,
          project_name: "Zouérat 1",
          name: "Mercure",
          initial_quantity: "500.000",
          current_quantity: "95.000",
          ...stamps,
        },
      ]),
    ),
  );
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function openAt(path: string) {
  const router = createMemoryRouter(
    [{ path: "/fr/refining", loader: refiningLoader, element: <RefiningScreen /> }],
    { initialEntries: [path] },
  );

  render(
    <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
      <RouterProvider router={router} />
    </IntlProvider>,
  );
}

function panel(title: string) {
  const section = screen.getByRole("heading", { name: title }).closest("section");

  if (section === null) {
    throw new Error(`no panel ${title}`);
  }

  return within(section);
}

describe("RefiningScreen", () => {
  it("lists the finished grinding operations that still wait for refining", async () => {
    openAt("/fr/refining");

    await screen.findByRole("heading", { name: text.queueTitle });
    const queue = panel(text.queueTitle);

    expect(queue.getByText("SH-2")).toBeVisible();
    expect(queue.queryByText("SH-1")).toBeNull();
    expect(queue.queryByText("SH-3")).toBeNull();
    expect(
      queue.getByRole("link", { name: "Démarrer l'affinage de l'expédition SH-2" }),
    ).toHaveAttribute("href", "/fr/refining?grinding=2");
  });

  it("shows every column of the refining operations", async () => {
    openAt("/fr/refining");

    await screen.findByRole("heading", { name: text.operationsTitle });
    const operations = panel(text.operationsTitle);

    expect(operations.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      text.fields.refinedAt,
      text.fields.shipment,
      text.fields.client,
      text.fields.project,
      text.fields.machine,
      text.fields.worker,
      text.fields.bags,
      text.fields.weightBefore,
      text.fields.weightAfter,
      text.fields.weightLoss,
      text.fields.gold,
      text.fields.goldWithMaterial,
      text.fields.goldWithoutMaterial,
      text.fields.loss,
      text.fields.lossReason,
      text.fields.notes,
    ]);
    const row = operations.getAllByRole("row")[1];

    if (row === undefined) {
      throw new Error("no operation row");
    }

    expect(
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual([
      "07/10/2026 09:30",
      "SH-3",
      "Client SH-3",
      "Zouérat 1",
      "P3-2",
      "Aicha",
      "4",
      "120,5",
      "118,25",
      "2,25",
      "14,3",
      "20",
      "14,3",
      "0,5",
      "Arghawa",
      "—",
    ]);
  });

  it("opens the form on the chosen grinding operation with the project's workers", async () => {
    openAt("/fr/refining?grinding=2");

    const dialog = within(await screen.findByRole("dialog", { name: text.new }));

    expect(dialog.getByText("SH-2")).toBeVisible();
    expect(
      within(dialog.getByLabelText(text.fields.worker))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Aicha"]);
    expect(dialog.queryByText("95")).toBeNull();
  });

  it("keeps the queue and explains refused operations inside their panel", async () => {
    server.use(
      http.get(`${API}/refining-operations/`, () => new HttpResponse(null, { status: 403 })),
    );
    openAt("/fr/refining");

    await screen.findByRole("heading", { name: text.queueTitle });

    expect(panel(text.queueTitle).getByText("SH-2")).toBeVisible();
    expect(panel(text.operationsTitle).getByRole("alert")).toHaveTextContent(
      messages.errors.forbidden.description,
    );
  });
});
