import { render } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import type { ApiSchema } from "@/lib/api/client";
import messages from "@/messages/fr.json";
import { AuditLogScreen, auditLogLoader } from "./AuditLogScreen";

export const API = `${window.location.origin}/api/v1`;
export const server = setupServer();
export const text = messages.auditLog;
export const common = messages.common;
export const filters = messages.filters;

export const page = (results: readonly object[]) =>
  HttpResponse.json({ count: results.length, results });

export const apiUpdate: ApiSchema<"AuditLog"> = {
  id: 12,
  timestamp: "2026-11-13T09:30:00Z",
  action: "update",
  action_display: "Modification",
  model: "Resource",
  model_name: "Ressource",
  object_id: "2",
  project: 3,
  project_name: "Zouérat 1",
  user: 4,
  user_name: "Aicha",
  user_email: "aicha@mills.mr",
  old_values: { current_quantity: "8.500", notes: "" },
  new_values: { current_quantity: "7.000", notes: "Vérifié" },
  changes: [
    { field: "current_quantity", label: "Quantité actuelle", old: "8.500", new: "7.000" },
    { field: "notes", label: "", old: "", new: "Vérifié" },
  ],
};

export const apiCreate: ApiSchema<"AuditLog"> = {
  ...apiUpdate,
  id: 13,
  action: "create",
  model: "Supplier",
  model_name: "Fournisseur",
  object_id: "5",
  old_values: null,
  new_values: { name: "Sidi Fournitures", phone: null },
  changes: [],
};

export const apiDelete: ApiSchema<"AuditLog"> = {
  ...apiUpdate,
  id: 14,
  action: "delete",
  model: "SupplierPayment",
  model_name: "Paiement fournisseur",
  object_id: "7",
  old_values: { amount: "1000.00" },
  new_values: null,
  changes: [],
};

export const apiModels = [
  { model: "Supplier", model_name: "Fournisseur" },
  { model: "Resource", model_name: "Ressource" },
];

export const apiUsers = [{ id: 4, email: "aicha@mills.mr", full_name: "Aicha", phone: "" }];

export const apiProjects = [{ id: 3, name: "Zouérat 1", site: "zouerat", is_active: true }];

export function serveAudit() {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => {
    server.use(
      http.get(`${API}/audit-logs/`, () => page([apiUpdate, apiCreate])),
      http.get(`${API}/audit-logs/models/`, () => HttpResponse.json(apiModels)),
      http.get(`${API}/audit-logs/:id/`, ({ params }) => {
        const entry = [apiUpdate, apiCreate, apiDelete].find(
          (candidate) => String(candidate.id) === params.id,
        );
        return entry === undefined
          ? new HttpResponse(null, { status: 404 })
          : HttpResponse.json(entry);
      }),
      http.get(`${API}/users/`, () => page(apiUsers)),
      http.get(`${API}/projects/`, () => page(apiProjects)),
    );
  });
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
}

export function openAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: "/fr",
        children: [{ path: "audit-log", loader: auditLogLoader, element: <AuditLogScreen /> }],
      },
    ],
    { initialEntries: [path] },
  );

  render(
    <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
      <RouterProvider router={router} />
    </IntlProvider>,
  );

  return router;
}
