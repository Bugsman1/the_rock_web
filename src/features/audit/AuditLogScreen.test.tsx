import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { formatDateTime } from "@/lib/format";
import {
  API,
  apiUpdate,
  common,
  filters,
  openAt,
  page,
  serveAudit,
  server,
  text,
} from "./auditTesting";

serveAudit();

function cellsOf(row: HTMLElement | undefined) {
  if (row === undefined) {
    throw new Error("row missing");
  }

  return within(row)
    .getAllByRole("cell")
    .map((cell) => cell.textContent);
}

function watchList() {
  const asked: URLSearchParams[] = [];
  server.use(
    http.get(`${API}/audit-logs/`, ({ request }) => {
      asked.push(new URL(request.url).searchParams);
      return page([]);
    }),
  );

  return asked;
}

describe("AuditLogScreen", () => {
  it("lists who did what to which record, newest first as the backend sends it", async () => {
    openAt("/fr/audit-log");

    expect(await screen.findByRole("heading", { name: text.title })).toBeVisible();
    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      text.fields.at,
      text.fields.user,
      text.fields.action,
      text.fields.model,
      text.fields.object,
      text.fields.project,
    ]);
    const rows = screen.getAllByRole("row");
    expect(cellsOf(rows[1])).toEqual([
      formatDateTime(apiUpdate.timestamp, "fr"),
      "Aicha",
      text.actions.update,
      "Ressource",
      "2",
      "Zouérat 1",
    ]);
    expect(cellsOf(rows[2])[2]).toBe(text.actions.create);
  });

  it("shows a dash when an entry has no user or project", async () => {
    server.use(
      http.get(`${API}/audit-logs/`, () =>
        page([
          {
            ...apiUpdate,
            user: null,
            user_name: null,
            user_email: null,
            project: null,
            project_name: null,
          },
        ]),
      ),
    );
    openAt("/fr/audit-log");

    await screen.findByText("Ressource");
    expect(cellsOf(screen.getAllByRole("row")[1])).toEqual([
      formatDateTime(apiUpdate.timestamp, "fr"),
      "—",
      text.actions.update,
      "Ressource",
      "2",
      "—",
    ]);
  });

  it("asks the backend for the search, every filter and the page in the address", async () => {
    const asked = watchList();
    openAt(
      "/fr/audit-log?q=sidi&action=delete&model=Supplier&user=4&project=3&from=2026-11-01&to=2026-11-13&page=2",
    );

    expect(await screen.findByText(text.noResults)).toBeVisible();
    expect(Object.fromEntries(asked[0] ?? [])).toEqual({
      page: "2",
      page_size: "25",
      search: "sidi",
      action: "delete",
      model: "Supplier",
      user: "4",
      project: "3",
      timestamp__date__gte: "2026-11-01",
      timestamp__date__lte: "2026-11-13",
    });
  });

  it("ignores filters the backend would not accept", async () => {
    const asked = watchList();
    openAt("/fr/audit-log?action=approve&user=me&from=yesterday");

    expect(await screen.findByText(text.empty)).toBeVisible();
    expect(Object.fromEntries(asked[0] ?? [])).toEqual({ page: "1", page_size: "25" });
  });

  it("filters by action, record type, user and project from the filter menu", async () => {
    const user = userEvent.setup();
    const router = openAt("/fr/audit-log?q=sidi");

    await user.click(await screen.findByRole("button", { name: filters.button }));
    await user.selectOptions(screen.getByLabelText(text.fields.action), text.actions.update);
    await user.selectOptions(screen.getByLabelText(text.fields.model), "Fournisseur");
    await user.selectOptions(screen.getByLabelText(text.fields.user), "Aicha");
    await user.selectOptions(screen.getByLabelText(text.fields.project), "Zouérat 1");
    await user.click(screen.getByRole("button", { name: filters.show }));

    await waitFor(() =>
      expect(Object.fromEntries(new URLSearchParams(router.state.location.search))).toEqual({
        q: "sidi",
        action: "update",
        model: "Supplier",
        user: "4",
        project: "3",
      }),
    );
  });

  it("leaves out the user and project filters when they cannot be loaded", async () => {
    server.use(
      http.get(`${API}/users/`, () => new HttpResponse(null, { status: 403 })),
      http.get(`${API}/projects/`, () => new HttpResponse(null, { status: 403 })),
    );
    const user = userEvent.setup();
    openAt("/fr/audit-log");

    await user.click(await screen.findByRole("button", { name: filters.button }));
    expect(screen.getByLabelText(text.fields.model)).toBeVisible();
    expect(screen.queryByLabelText(text.fields.user)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(text.fields.project)).not.toBeInTheDocument();
  });

  it("opens an entry with the fields an update changed, before and after", async () => {
    const user = userEvent.setup();
    const router = openAt("/fr/audit-log?action=update");

    const row = (await screen.findAllByRole("row"))[1];
    await user.click(within(row ?? document.body).getByRole("link"));

    const dialog = within(await screen.findByRole("dialog", { name: text.entry.title }));
    expect(router.state.location.search).toBe("?action=update&entry=12");
    expect(dialog.getByText("aicha@mills.mr")).toBeVisible();
    expect(cellsOf(dialog.getAllByRole("row")[1])).toEqual(["Quantité actuelle", "8.500", "7.000"]);
    expect(cellsOf(dialog.getAllByRole("row")[2])).toEqual(["notes", "—", "Vérifié"]);

    await user.click(dialog.getByRole("button", { name: common.close }));
    await waitFor(() => expect(router.state.location.search).toBe("?action=update"));
  });

  it("shows the whole record of a deletion from a link", async () => {
    openAt("/fr/audit-log?entry=14");

    const dialog = within(await screen.findByRole("dialog", { name: text.entry.title }));
    expect(dialog.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      text.entry.field,
      text.entry.value,
    ]);
    expect(cellsOf(dialog.getAllByRole("row")[1])).toEqual(["amount", "1000.00"]);
    expect(dialog.getByText(text.actions.delete)).toBeVisible();
  });

  it("opens no entry the backend does not have", async () => {
    openAt("/fr/audit-log?entry=99");

    expect(await screen.findByText("Ressource")).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
