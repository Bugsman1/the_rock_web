import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { noAccess } from "@/lib/access";
import type { Access } from "@/lib/access";
import { AccessContext } from "@/lib/accessContext";
import messages from "@/messages/fr.json";
import { endOperation, getMillingData } from "./millingApi";
import {
  MachineDetailScreen,
  machineLoader,
  MillingProjectScreen,
  millingProjectLoader,
  MillingScreen,
  millingLoader,
} from "./MillingScreens";

const allRights: Access = { ...noAccess, superuser: true };

const API = `${window.location.origin}/api/v1`;
const server = setupServer();
const text = messages.milling;

const stamps = {
  is_active: true,
  created_at: "2026-10-01T08:00:00Z",
  updated_at: "2026-10-01T08:00:00Z",
};

const page = (results: readonly object[]) => HttpResponse.json({ count: results.length, results });

const shipment = (id: number, status: string, bags: number) => ({
  id,
  number: `SH-${id}`,
  customer: 1,
  customer_name: `Client ${id}`,
  customer_phone: "+222 22 41 18 30",
  arrival_date: `2026-10-0${id % 9}T08:00:00Z`,
  bags_count: bags,
  bag_transport_cost_per_bag: "0",
  transport_method: "truck",
  source: "Chami",
  project: 3,
  status,
  notes: "",
  created_by: null,
  created_by_name: null,
  ...stamps,
});

const runningOperation = {
  id: 5,
  shipment_number: "SH-1",
  customer_name: "Client 1",
  grinder_code: "P3-1",
  project_name: "Zouérat 1",
  bags_count: 2,
  start_time: "2026-10-08T06:00:00.000Z",
  end_time: null,
  operator_name: "Ahmed",
  grinding_cost: "30000",
  notes: "",
  ...stamps,
};

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  server.use(
    http.get(`${API}/projects/`, () =>
      page([{ id: 3, name: "Zouérat 1", site: "zouerat", status: "active", ...stamps }]),
    ),
    http.get(`${API}/grinders/`, () =>
      page([
        { id: 7, project: 3, code: "P3-1", status: "active", ...stamps },
        { id: 8, project: 3, code: "P3-2", status: "active", ...stamps },
        { id: 9, project: 3, code: "P3-3", status: "maintenance", ...stamps },
      ]),
    ),
    http.get(`${API}/shipments/`, () =>
      page([
        shipment(1, "grinding", 6),
        shipment(2, "grinding", 4),
        shipment(3, "completed", 5),
        shipment(4, "pending", 3),
      ]),
    ),
    http.get(`${API}/grinding-operations/`, () => page([runningOperation])),
  );
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function openAt(path: string, access: Access = allRights) {
  const router = createMemoryRouter(
    [
      {
        path: "/fr",
        children: [
          { path: "milling", loader: millingLoader, element: <MillingScreen /> },
          {
            path: "milling/projects/:project",
            loader: millingProjectLoader,
            element: <MillingProjectScreen />,
          },
          {
            path: "milling/projects/:project/machines/:machine",
            loader: machineLoader,
            element: <MachineDetailScreen />,
          },
        ],
      },
    ],
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

describe("getMillingData", () => {
  it("keeps the waiting and grinding shipments and places each operation on its machine", async () => {
    const data = await getMillingData();

    expect(data.shipments.map((item) => item.shipmentNumber)).toEqual(["SH-1", "SH-2", "SH-4"]);
    expect(data.machines.map((machine) => machine.number)).toEqual([1, 2, 3]);
    expect(data.operations).toMatchObject([{ id: "5", machine: 1, operatorName: "Ahmed" }]);
  });
});

describe("endOperation", () => {
  it("records the end, then sets the shipment's status", async () => {
    let ended: unknown;
    let shipmentChange: unknown;
    server.use(
      http.patch(`${API}/grinding-operations/5/`, async ({ request }) => {
        ended = await request.json();
        return HttpResponse.json({});
      }),
      http.patch(`${API}/shipments/1/`, async ({ request }) => {
        shipmentChange = await request.json();
        return HttpResponse.json({});
      }),
    );
    const [operation] = (await getMillingData()).operations;

    if (operation === undefined) {
      throw new Error("operation missing");
    }

    const result = await endOperation(
      operation,
      "1",
      { endDate: "2026-10-08", endTime: "12:00", notes: "Sac abîmé" },
      "2026-10-08T12:00:00.000Z",
      "grinding",
    );

    expect(result).toEqual({ ok: true });
    expect(ended).toEqual({
      end_time: "2026-10-08T12:00:00.000Z",
      notes: "Sac abîmé",
    });
    expect(shipmentChange).toEqual({ status: "grinding" });
  });
});

describe("milling screens", () => {
  it("sums the machines and bags of every project", async () => {
    openAt("/fr/milling");

    expect(await screen.findByRole("heading", { name: /Zouérat 1/ })).toBeVisible();
    expect(screen.getAllByText(text.kpis.machinesRunning).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: messages.sites.zouerat })).toHaveAttribute(
      "href",
      "/fr/milling?site=zouerat",
    );
  });

  it("shows the bags waiting, grinding and ground today, and the machines running", async () => {
    openAt("/fr/milling");

    const flow = within(await screen.findByRole("region", { name: text.flow.title }));
    const cards = flow.getAllByRole("term").map((card) => card.parentElement?.textContent);

    expect(cards).toEqual([
      `${text.flow.waiting}11${text.flow.bags}`,
      `${text.flow.milling}2${text.flow.bags}`,
      `${text.flow.milledToday}0${text.flow.bags}`,
      `${text.kpis.machinesRunning}1sur 3`,
    ]);
    expect(flow.getByText("sur 3")).toBeVisible();
  });

  it("marks a backlog once 50 bags are waiting", async () => {
    server.use(http.get(`${API}/shipments/`, () => page([shipment(4, "pending", 50)])));
    openAt("/fr/milling");

    const flow = within(await screen.findByRole("region", { name: text.flow.title }));

    expect(flow.getByText(text.flow.backlog)).toBeVisible();
  });

  it("finds a waiting shipment by client or number", async () => {
    const user = userEvent.setup();
    openAt("/fr/milling/projects/3");

    const search = await screen.findByLabelText(
      messages.common.searchIn.replace("{list}", text.project.queueTitle),
    );
    await user.type(search, "client 4");

    const queue = within(search.closest("section") ?? document.body);
    expect(queue.getByText("SH-4")).toBeVisible();
    expect(queue.queryByText("SH-2")).toBeNull();

    await user.clear(search);
    await user.type(search, "SH-99");
    expect(queue.getByText(messages.common.noMatch)).toBeVisible();
  });

  it("filters the machines of a project by status", async () => {
    const user = userEvent.setup();
    openAt("/fr/milling/projects/3");

    const [table] = await screen.findAllByRole("table");

    if (table === undefined) {
      throw new Error("machine table missing");
    }

    expect(within(table).getAllByRole("row")).toHaveLength(4);

    await user.click(screen.getByRole("button", { name: new RegExp(text.statuses.running) }));

    const [, ...rows] = within(table).getAllByRole("row");
    expect(rows).toHaveLength(1);
    expect(within(rows[0] ?? table).getByText("Client 1")).toBeVisible();
  });

  it("queues the shipments that still have bags to mill", async () => {
    openAt("/fr/milling/projects/3");

    expect(await screen.findByText("SH-2")).toBeVisible();
    expect(
      screen
        .getAllByRole("link", { name: text.project.start })
        .map((link) => link.getAttribute("href")),
    ).toContain("/fr/milling/projects/3?operation=new&shipment=SH-2");
  });

  it("shows the running operation and every grinding of the machine", async () => {
    server.use(
      http.get(`${API}/grinding-operations/`, () =>
        page([
          runningOperation,
          {
            ...runningOperation,
            id: 4,
            shipment_number: "SH-3",
            customer_name: "Client 3",
            start_time: "2026-10-07T06:00:00.000Z",
            end_time: "2026-10-07T12:00:00.000Z",
          },
        ]),
      ),
    );
    openAt("/fr/milling/projects/3/machines/1");

    const heading = await screen.findByRole("heading", { name: text.machine.history.title });
    expect(screen.getByRole("button", { name: new RegExp(text.machine.endMilling) })).toBeVisible();

    const section = heading.closest("section");

    if (section === null) {
      throw new Error("history panel missing");
    }

    const [, running, ended] = within(section).getAllByRole("row");
    expect(within(running ?? section).getByText(text.machine.history.running)).toBeVisible();
    expect(within(ended ?? section).getByText("SH-3")).toBeVisible();
    expect(within(ended ?? section).getByText("6 h 0 min")).toBeVisible();
    expect(within(ended ?? section).getByText(text.machine.history.done)).toBeVisible();
  });
});
