import { render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { PageError } from "@/app/PageStates";
import { ToastProvider } from "@/components/ui/Toast";
import { noAccess } from "@/lib/access";
import type { Access } from "@/lib/access";
import { AccessContext } from "@/lib/accessContext";
import messages from "@/messages/fr.json";
import {
  RefiningProjectScreen,
  refiningProjectLoader,
  RefiningScreen,
  refiningLoader,
} from "./RefiningScreen";

const allRights: Access = { ...noAccess, superuser: true };

export const API = `${window.location.origin}/api/v1`;
export const server = setupServer();
export const text = messages.refining;

const stamps = {
  is_active: true,
  created_at: "2026-10-01T08:00:00Z",
  updated_at: "2026-10-01T08:00:00Z",
};

export const page = (results: readonly object[]) =>
  HttpResponse.json({ count: results.length, results });

const grinding = (
  id: number,
  shipment: string,
  code: string,
  endTime: string | null,
  mercuryAddedAt: string | null = "2026-10-05T08:00:00Z",
) => ({
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
  mercury_added_at: mercuryAddedAt,
  mercury_added_by_name: "Ahmed",
  mercury_quantity: "120.000",
  notes: "",
  created_at: "2026-10-05T06:00:00Z",
  updated_at: "2026-10-05T06:00:00Z",
});

const zouerat = { id: 3, name: "Zouérat 1", site: "zouerat", status: "active", ...stamps };

export function withTwoProjects() {
  server.use(
    http.get(`${API}/projects/`, () =>
      page([zouerat, { id: 4, name: "Sfariyat 1", site: "sfariyat", status: "active", ...stamps }]),
    ),
  );
}

export const refined = {
  id: 9,
  grinding_operation: 3,
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

export function serveRefiningApi() {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => {
    server.use(
      http.get(`${API}/projects/`, () => page([zouerat])),
      http.get(`${API}/projects/3/`, () =>
        HttpResponse.json({
          id: 3,
          name: "Zouérat 1",
          site: "zouerat",
          status: "active",
          ...stamps,
        }),
      ),
      http.get(`${API}/grinding-operations/`, () =>
        page([
          grinding(1, "SH-1", "P3-1", null),
          grinding(2, "SH-2", "P3-2", "2026-10-05T18:00:00Z"),
          grinding(3, "SH-3", "P3-2", "2026-10-05T18:00:00Z"),
          grinding(4, "SH-4", "P3-1", "2026-10-05T18:00:00Z", null),
        ]),
      ),
      http.get(`${API}/refining-operations/`, () => page([refined])),
      http.get(`${API}/operators/`, ({ request }) =>
        HttpResponse.json(
          new URL(request.url).searchParams.get("project") === "3"
            ? [{ id: 4, name: "Aicha" }]
            : [],
        ),
      ),
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
}

export function openAt(path: string, access: Access = allRights) {
  const router = createMemoryRouter(
    [
      {
        path: "/:locale/refining",
        loader: refiningLoader,
        element: <RefiningScreen />,
        errorElement: <PageError />,
      },
      {
        path: "/:locale/refining/projects/:project",
        loader: refiningProjectLoader,
        element: <RefiningProjectScreen />,
        errorElement: <PageError />,
      },
    ],
    { initialEntries: [path] },
  );

  render(
    <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
      <AccessContext value={access}>
        <ToastProvider anchor={{ current: null }}>
          <RouterProvider router={router} />
        </ToastProvider>
      </AccessContext>
    </IntlProvider>,
  );
}

export function panel(title: string) {
  const section = screen.getByRole("heading", { name: title }).closest("section");

  if (section === null) {
    throw new Error(`no panel ${title}`);
  }

  return within(section);
}
