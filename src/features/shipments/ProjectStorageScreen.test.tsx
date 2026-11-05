import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { noAccess } from "@/lib/access";
import { AccessContext } from "@/lib/accessContext";
import messages from "@/messages/fr.json";
import { ProjectStorageScreen, projectStorageLoader } from "./ProjectStorageScreen";

const allRights = { ...noAccess, superuser: true };

const API = `${window.location.origin}/api/v1`;

const server = setupServer();

const operationForm = messages.milling.operation;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const stamps = {
  is_active: true,
  created_at: "2026-10-01T08:00:00Z",
  updated_at: "2026-10-01T08:00:00Z",
};

const page = (results: readonly object[]) => HttpResponse.json({ count: results.length, results });

function apiShipment(id: number, status: string, remaining = 10) {
  return {
    id,
    number: `SH-${id}`,
    customer_name: `Client ${id}`,
    customer_phone: "+222 22 41 18 30",
    arrival_date: `2026-10-0${id}T08:00:00Z`,
    bags_count: 10,
    remaining_bags: remaining,
    bag_transport_cost_per_bag: "100.00",
    transport_total: "1000.00",
    amount_left_to_pay: "1000.00",
    is_fully_paid: false,
    transport_method: "truck",
    source: "zouerat",
    project: 3,
    status,
    notes: "",
    created_by_name: "med",
    created_at: "2026-10-01T08:00:00Z",
    updated_at: "2026-10-01T08:00:00Z",
  };
}

function apiProject(id: number, name: string) {
  return { id, name, site: "zouerat", status: "active", ...stamps };
}

function answerProjectList(projects: readonly object[]) {
  server.use(http.get(`${API}/projects/`, () => page(projects)));
}

function answerProject() {
  answerProjectList([apiProject(3, "Zouérat 1"), apiProject(4, "Zouérat 2")]);
  server.use(
    http.get(`${API}/projects/3/`, () =>
      HttpResponse.json({ id: 3, name: "Zouérat 1", site: "zouerat", status: "active", ...stamps }),
    ),
    http.get(`${API}/shipments/`, () =>
      page([
        apiShipment(1, "pending"),
        apiShipment(2, "grinding", 8.5),
        apiShipment(3, "completed", 0),
      ]),
    ),
    http.get(`${API}/grinding-operations/`, () =>
      page([
        {
          id: 9,
          shipment_number: "SH-2",
          customer_name: "Client 2",
          grinder_code: "P3-1",
          project_name: "Zouérat 1",
          bags_count: 1.5,
          start_time: "2026-10-08T06:00:00Z",
          end_time: null,
          operator_name: "Ahmed",
          grinding_cost: "22500",
          notes: "",
          ...stamps,
        },
      ]),
    ),
  );
}

function answerGrindingChoices() {
  server.use(
    http.get(`${API}/grinders/`, () =>
      page([{ id: 7, project: 3, code: "P3-1", status: "active", ...stamps }]),
    ),
    http.get(`${API}/grinding-operations/`, () => page([])),
    http.get(`${API}/operators/`, () => HttpResponse.json([{ id: 4, name: "Aicha" }])),
  );
}

function answerShipments(rows: readonly object[], total = rows.length) {
  const asked: URLSearchParams[] = [];
  server.use(
    http.get(`${API}/shipments/`, ({ request }) => {
      const query = new URL(request.url).searchParams;
      if (!query.has("has_remaining_bags")) asked.push(query);
      return HttpResponse.json({ count: total, results: rows });
    }),
  );

  return asked;
}

const showResultsButton = () => screen.getByRole("button", { name: messages.filters.show });

function openProject(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: "/fr/shipments/projects/:project",
        loader: projectStorageLoader,
        element: <ProjectStorageScreen />,
      },
      { path: "/fr/milling/projects/:project", element: <h1>grinding page</h1> },
    ],
    { initialEntries: [path] },
  );

  render(
    <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
      <AccessContext value={allRights}>
        <RouterProvider router={router} />
      </AccessContext>
    </IntlProvider>,
  );

  return router;
}

describe("ProjectStorageScreen", () => {
  it("asks the backend for the typed search and hides the places in line", async () => {
    answerProject();
    const asked = answerShipments([apiShipment(2, "pending")]);
    const user = userEvent.setup();
    const router = openProject("/fr/shipments/projects/3");

    const search = await screen.findByLabelText(
      messages.common.searchIn.replace("{list}", messages.shipments.project.queueTitle),
    );
    await user.type(search, "46 00");

    await vi.waitFor(() => expect(router.state.location.search).toBe("?q=46+00"));
    await vi.waitFor(() => expect(asked.at(-1)?.get("search")).toBe("46 00"));
    await vi.waitFor(() =>
      expect(
        screen.queryByRole("columnheader", { name: messages.shipments.project.position }),
      ).toBeNull(),
    );
  });

  it("lists the shipments still to grind, oldest first, one page at a time", async () => {
    answerProject();
    const asked = answerShipments([apiShipment(1, "pending"), apiShipment(2, "grinding", 8.5)], 30);
    const user = userEvent.setup();
    const router = openProject("/fr/shipments/projects/3");

    expect(await screen.findByText("SH-1")).toBeVisible();
    expect(asked[0]?.get("status__in")).toBe("pending,grinding,refining");
    expect(asked[0]?.get("ordering")).toBe("arrival_date");
    expect(asked[0]?.get("page_size")).toBe("25");
    const [, waiting, started] = screen.getAllByRole("row");
    expect(waiting).toHaveTextContent("1SH-1");
    expect(waiting).toHaveTextContent("10 sur 10");
    expect(waiting).toHaveTextContent(messages.shipments.statuses.pending);
    expect(started).toHaveTextContent("8,5 sur 10");
    expect(started).toHaveTextContent(messages.shipments.statuses.grinding);
    expect(screen.getByRole("link", { name: "SH-1" })).toHaveAttribute("href", "/fr/shipments/1");
    expect(waiting).toHaveTextContent(messages.shipments.payment.incomplete);
    expect(
      screen.getByRole("link", { name: `${messages.shipments.project.startMilling} SH-1` }),
    ).toHaveAttribute("href", "/fr/shipments/projects/3?grind=SH-1");

    await user.click(screen.getByRole("button", { name: messages.common.showMore }));

    await vi.waitFor(() => expect(asked.at(-1)?.get("page")).toBe("2"));
    expect(asked.at(-1)?.get("page_size")).toBe("25");
    expect(router.state.location.search).toBe("");
    await vi.waitFor(() => expect(screen.getAllByRole("link", { name: "SH-1" })).toHaveLength(2));
    expect(screen.getAllByRole("row")[3]).toHaveTextContent("3SH-1");
  });

  it("sends the chosen stages and payment to the backend and keeps them in the address", async () => {
    answerProject();
    const asked = answerShipments([apiShipment(2, "grinding", 8.5)]);
    const user = userEvent.setup();
    const router = openProject("/fr/shipments/projects/3");

    await screen.findByText("SH-2");
    await user.click(screen.getByRole("link", { name: new RegExp(messages.filters.button) }));
    await user.click(
      await screen.findByRole("checkbox", { name: messages.shipments.statuses.grinding }),
    );
    await user.click(screen.getByRole("checkbox", { name: messages.shipments.payment.incomplete }));
    await user.click(
      screen.getByRole("checkbox", { name: messages.shipments.transportMethods.truck }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: messages.shipments.transportMethods.hilux }),
    );
    await user.click(showResultsButton());

    await vi.waitFor(() =>
      expect(router.state.location.search).toBe("?status=grinding&payment=unpaid&transport=hilux"),
    );
    await vi.waitFor(() => expect(asked.at(-1)?.get("status__in")).toBe("grinding"));
    expect(asked.at(-1)?.get("is_fully_paid")).toBe("false");
    expect(asked.at(-1)?.get("transport_method")).toBe("hilux");
    await vi.waitFor(() =>
      expect(
        screen.getByRole("link", { name: new RegExp(messages.filters.button) }),
      ).toHaveTextContent("3"),
    );
    expect(
      screen.queryByRole("columnheader", { name: messages.shipments.project.position }),
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: `${messages.shipments.project.startMilling} SH-2` }),
    ).toHaveAttribute(
      "href",
      "/fr/shipments/projects/3?status=grinding&payment=unpaid&transport=hilux&grind=SH-2",
    );
  });

  it("asks the invoice language from the PDF button and says so when the download fails", async () => {
    answerProject();
    let asked: string | null = null;
    server.use(
      http.get(`${API}/shipments/1/invoice/`, ({ request }) => {
        asked = new URL(request.url).searchParams.get("lang");
        return HttpResponse.json({ detail: "error" }, { status: 500 });
      }),
    );
    const user = userEvent.setup();
    openProject("/fr/shipments/projects/3");

    await user.click(
      await screen.findByRole("button", {
        name: messages.shipments.invoice.open.replace("{number}", "SH-1"),
      }),
    );
    const languages = within(
      screen.getByRole("group", {
        name: messages.shipments.invoice.languages.replace("{number}", "SH-1"),
      }),
    );
    await user.click(languages.getByRole("button", { name: messages.shipments.invoice.ar }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      messages.shipments.form.saved.failed,
    );
    expect(asked).toBe("ar");
  });

  it("adds a shipment to this project", async () => {
    answerProject();
    openProject("/fr/shipments/projects/3");

    expect(await screen.findByRole("link", { name: messages.shipments.addNew })).toHaveAttribute(
      "href",
      "/fr/shipments/new?project=3",
    );
  });

  it("has no way back to the projects for a user limited to one project", async () => {
    answerProject();
    answerProjectList([apiProject(3, "Zouérat 1")]);
    openProject("/fr/shipments/projects/3");

    expect(await screen.findByText("SH-1")).toBeVisible();
    expect(screen.queryByRole("link", { name: messages.common.back })).toBeNull();
  });

  it("keeps a fully ground shipment in the list as refining, with no grinding to start", async () => {
    answerProjectList([apiProject(3, "Zouérat 1"), apiProject(4, "Zouérat 2")]);
    server.use(
      http.get(`${API}/projects/3/`, () =>
        HttpResponse.json({
          id: 3,
          name: "Zouérat 1",
          site: "zouerat",
          status: "active",
          ...stamps,
        }),
      ),
      http.get(`${API}/shipments/`, () =>
        page([{ ...apiShipment(4, "grinding", 0), ground_bags: 10, is_ground: true }]),
      ),
      http.get(`${API}/grinding-operations/`, () =>
        page([
          {
            id: 11,
            shipment_number: "SH-4",
            customer_name: "Client 4",
            grinder_code: "P3-1",
            project_name: "Zouérat 1",
            bags_count: 10,
            start_time: "2026-10-04T06:00:00Z",
            end_time: "2026-10-04T18:00:00Z",
            operator_name: "Ahmed",
            notes: "",
            ...stamps,
          },
        ]),
      ),
    );
    openProject("/fr/shipments/projects/3");

    expect(await screen.findByText("SH-4")).toBeVisible();
    const [, refining] = screen.getAllByRole("row");
    expect(refining).toHaveTextContent(messages.shipments.statuses.refining);
    expect(refining).toHaveTextContent("0 sur 10");
    expect(
      screen.queryByRole("link", { name: `${messages.shipments.project.startMilling} SH-4` }),
    ).toBeNull();
  });

  it("starts grinding from the shipments page and goes to the grinding page", async () => {
    answerProject();
    answerGrindingChoices();
    let created: unknown;
    server.use(
      http.post(`${API}/grinding-operations/`, async ({ request }) => {
        created = await request.json();
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    const router = openProject("/fr/shipments/projects/3?grind=SH-1");
    const user = userEvent.setup();

    const dialog = within(await screen.findByRole("dialog", { name: operationForm.title }));
    expect(dialog.getByLabelText(operationForm.shipment)).toHaveValue("SH-1");

    await user.selectOptions(dialog.getByLabelText(operationForm.machine), "1");
    await user.type(dialog.getByLabelText(operationForm.bags), "2");
    await user.selectOptions(dialog.getByLabelText(operationForm.operator), "4");
    await user.click(dialog.getByRole("button", { name: operationForm.submit }));

    expect(await screen.findByRole("heading", { name: "grinding page" })).toBeVisible();
    expect(router.state.location.pathname).toBe("/fr/milling/projects/3");
    expect(created).toMatchObject({ shipment: 1, grinder: 7, bags_count: 2, operator: 4 });
  });
});
