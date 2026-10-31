import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import {
  API,
  apiAbsence,
  apiEmployee,
  capture,
  cellsOf,
  openAt,
  openTab,
  rowsOf,
  serveEmployeeData,
  serveEmployeeRecords,
  serveEmployees,
  serveProjects,
  server,
  text,
  viewOnly,
} from "./employeesTesting";

serveEmployees();

function serveAbsences() {
  serveProjects([11]);
  serveEmployeeData([apiEmployee(7)]);
  serveEmployeeRecords({
    absences: [
      apiAbsence(4),
      apiAbsence(3, { start_date: "2026-09-01", end_date: "2026-09-01", days: 1, reason: "" }),
    ],
  });
}

describe("an employee's days deducted", () => {
  it("lists each deduction with the days the backend counted, under its tab", async () => {
    serveAbsences();
    openAt("/fr/employees/7");

    await openTab(text.tabs.deductions);
    expect(rowsOf(text.absences.title).map((row) => cellsOf(row).slice(0, 5))).toEqual([
      ["05/10/2026", "07/10/2026", "3", "Malade", "admin"],
      ["01/09/2026", "01/09/2026", "1", "—", "admin"],
    ]);
  });

  it("deducts one day when no end date is typed", async () => {
    serveAbsences();
    const sent = capture("post", "/employee-absences/");
    const user = userEvent.setup();
    openAt("/fr/employees/7");

    await user.click(await screen.findByRole("link", { name: text.absences.new }));

    const drawer = within(await screen.findByRole("dialog", { name: text.absences.newTitle }));
    await user.type(drawer.getByLabelText(text.fields.from), "12/10/2026");
    await user.type(drawer.getByLabelText(text.fields.reason), "Voyage");
    await user.click(drawer.getByRole("button", { name: text.absences.create }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(sent).toEqual([
      { employee: 7, start_date: "2026-10-12", end_date: "2026-10-12", reason: "Voyage" },
    ]);
  });

  it("refuses an end before the start, and shows the backend's refusal on the dates", async () => {
    serveAbsences();
    const sent = capture(
      "post",
      "/employee-absences/",
      HttpResponse.json({ start_date: ["L'employé est déjà absent."] }, { status: 400 }),
    );
    const user = userEvent.setup();
    openAt("/fr/employees/7?addAbsence=1");

    const drawer = within(await screen.findByRole("dialog", { name: text.absences.newTitle }));
    await user.type(drawer.getByLabelText(text.fields.from), "12/10/2026");
    await user.type(drawer.getByLabelText(text.fields.to), "11/10/2026");
    await user.click(drawer.getByRole("button", { name: text.absences.create }));
    expect(await drawer.findByText(text.errors.absenceEndBeforeStart)).toBeVisible();
    expect(sent).toEqual([]);

    await user.clear(drawer.getByLabelText(text.fields.to));
    await user.type(drawer.getByLabelText(text.fields.to), "14/10/2026");
    await user.click(drawer.getByRole("button", { name: text.absences.create }));

    expect(await drawer.findByText("L'employé est déjà absent.")).toBeVisible();
    expect(sent).toHaveLength(1);
  });

  it("changes a deduction from its row, filled with what was recorded", async () => {
    serveAbsences();
    const sent = capture("patch", "/employee-absences/4/");
    const user = userEvent.setup();
    openAt("/fr/employees/7");

    await openTab(text.tabs.deductions);
    await user.click(screen.getByRole("link", { name: "Modifier la retenue du 05/10/2026" }));

    const drawer = within(await screen.findByRole("dialog", { name: text.absences.editTitle }));
    expect(drawer.getByLabelText(text.fields.to)).toHaveValue("07/10/2026");
    await user.clear(drawer.getByLabelText(text.fields.reason));
    await user.type(drawer.getByLabelText(text.fields.reason), "Hôpital");
    await user.click(drawer.getByRole("button", { name: text.form.save }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(sent).toEqual([{ start_date: "2026-10-05", end_date: "2026-10-07", reason: "Hôpital" }]);
  });

  it("deletes a deduction only after confirming", async () => {
    serveAbsences();
    let deleted = false;
    server.use(
      http.delete(`${API}/employee-absences/4/`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    openAt("/fr/employees/7?deleteAbsence=4");

    const drawer = within(await screen.findByRole("dialog", { name: text.absences.removeTitle }));
    expect(drawer.getByText(/05\/10\/2026 au 07\/10\/2026/)).toBeVisible();
    expect(deleted).toBe(false);
    await user.click(drawer.getByRole("button", { name: text.remove.confirm }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(deleted).toBe(true);
  });

  it("offers no deduction, edit or delete to a role that can only view", async () => {
    serveAbsences();
    openAt("/fr/employees/7?addAbsence=1", viewOnly);

    await openTab(text.tabs.deductions);
    expect(screen.queryByRole("link", { name: text.absences.new })).toBeNull();
    expect(screen.queryByRole("link", { name: /la retenue du/ })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
