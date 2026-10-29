import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import {
  API,
  apiEmployee,
  cellsOf,
  common,
  money,
  openAt,
  serveEmployeeData,
  serveEmployees,
  serveProjects,
  server,
  text,
  viewOnly,
} from "./employeesTesting";

serveEmployees();

function rowOf(matricule: string) {
  const row = screen.getByRole("cell", { name: matricule }).closest("tr");

  if (row === null) {
    throw new Error(`no row ${matricule}`);
  }

  return row;
}

const owing = apiEmployee(8, {
  full_name: "Mariem",
  job_title: "Gardien",
  phone: "+22246109325",
  balance: "-6000.00",
  debt: "6000.00",
});

describe("employees overview", () => {
  it("shows each project with only its number of employees", async () => {
    serveProjects([11, 12]);
    serveEmployeeData([apiEmployee(7), owing, apiEmployee(9, { project: 12 })]);
    openAt("/fr/employees");

    const card = (await screen.findByRole("heading", { name: "Projet Projet 11" })).closest(
      "section",
    );

    if (card === null) {
      throw new Error("card missing");
    }

    expect(within(card).getByText(text.employeeCount).nextSibling).toHaveTextContent("2");
    expect(within(card).queryByText(money(-6000))).toBeNull();
  });

  it("goes straight to the only project in service", async () => {
    serveProjects([11]);
    serveEmployeeData([]);
    const router = openAt("/fr/employees");

    expect(await screen.findByText(text.empty)).toBeVisible();
    expect(router.state.location.pathname).toBe("/fr/employees/projects/11");
    expect(screen.queryByRole("link", { name: common.back })).toBeNull();
  });
});

describe("a project's employees", () => {
  it("lists every employee with what is owed, a debt in red with a minus", async () => {
    serveProjects([11, 12]);
    serveEmployeeData([apiEmployee(7), owing]);
    openAt("/fr/employees/projects/11");

    await screen.findByRole("cell", { name: "EMP-8" });
    expect(cellsOf(rowOf("EMP-8")).slice(0, 7)).toEqual([
      "EMP-8",
      "Mariem",
      "Gardien",
      "+222 46 10 93 25",
      money(40000),
      "01/01/2026",
      money(-6000),
    ]);
    expect(within(rowOf("EMP-8")).getByText(money(-6000))).toHaveClass("text-danger-700");
    expect(within(rowOf("EMP-7")).getByRole("link", { name: "EMP-7" })).toHaveAttribute(
      "href",
      "/fr/employees/7",
    );
  });

  it("finds an employee by the job typed for them", async () => {
    serveProjects([11, 12]);
    serveEmployeeData([apiEmployee(7), owing]);
    const user = userEvent.setup();
    openAt("/fr/employees/projects/11");

    await user.type(await screen.findByRole("searchbox"), "gard");

    expect(screen.getByRole("cell", { name: "EMP-8" })).toBeVisible();
    expect(screen.queryByRole("cell", { name: "EMP-7" })).toBeNull();
  });

  it("adds an employee with a typed job, after refusing an incomplete form", async () => {
    serveProjects([11, 12]);
    serveEmployeeData([]);
    const sent: unknown[] = [];
    server.use(
      http.post(`${API}/employees/`, async ({ request }) => {
        sent.push(await request.json());
        return HttpResponse.json(apiEmployee(10), { status: 201 });
      }),
    );
    const user = userEvent.setup();
    openAt("/fr/employees/projects/11?new=1");

    const drawer = within(await screen.findByRole("dialog", { name: text.form.newTitle }));
    await user.click(drawer.getByRole("button", { name: text.form.create }));
    expect(drawer.getAllByText(common.validation.required).length).toBeGreaterThan(0);
    expect(drawer.getByText(text.errors.salaryInvalid)).toBeVisible();

    await user.type(drawer.getByLabelText(text.fields.matricule), "EMP-010");
    await user.type(drawer.getByLabelText(text.fields.name), "Mariem");
    await user.type(drawer.getByLabelText(text.fields.job), "Gardien");
    await user.type(drawer.getByLabelText(text.fields.phone), "36520714");
    await user.type(drawer.getByLabelText(text.fields.monthlySalary), "18000");
    await user.type(drawer.getByLabelText(text.fields.startedOn), "01/10/2026");
    await user.type(drawer.getByLabelText(text.fields.startTime), "08:30");
    await user.type(drawer.getByLabelText(text.fields.endedOn), "30/09/2026");
    await user.click(drawer.getByRole("button", { name: text.form.create }));
    expect(await drawer.findByText(text.errors.endBeforeStart)).toBeVisible();

    await user.clear(drawer.getByLabelText(text.fields.endedOn));
    await user.click(drawer.getByRole("button", { name: text.form.create }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(sent).toEqual([
      expect.objectContaining({
        job_title: "Gardien",
        monthly_salary: "18000",
        start_date: "2026-10-01T08:30:00.000Z",
        end_date: null,
      }),
    ]);
  });

  it("shows the salary read-only when changing an employee", async () => {
    serveProjects([11, 12]);
    serveEmployeeData([apiEmployee(7)]);
    openAt("/fr/employees/projects/11?edit=7");

    const drawer = within(await screen.findByRole("dialog", { name: text.form.editTitle }));
    expect(drawer.getByText(money(40000))).toBeVisible();
    expect(drawer.queryByRole("spinbutton", { name: text.fields.monthlySalary })).toBeNull();
    expect(drawer.getByLabelText(text.fields.job)).toHaveValue("Chauffeur");
    expect(drawer.getByLabelText(text.fields.startedOn)).toHaveValue("01/01/2026");
    expect(drawer.getByLabelText(text.fields.startTime)).toHaveValue("08:00");
  });

  it("deletes an employee only after confirming, and shows why the backend refused", async () => {
    serveProjects([11, 12]);
    serveEmployeeData([apiEmployee(7)]);
    server.use(
      http.delete(`${API}/employees/7/`, () =>
        HttpResponse.json(["Cet employé a des retraits."], { status: 400 }),
      ),
    );
    const user = userEvent.setup();
    openAt("/fr/employees/projects/11");

    await screen.findByRole("cell", { name: "EMP-7" });
    await user.click(within(rowOf("EMP-7")).getByRole("link", { name: "Supprimer Sidi Ahmed" }));

    const drawer = within(await screen.findByRole("dialog", { name: text.remove.title }));
    await user.click(drawer.getByRole("button", { name: text.remove.confirm }));

    expect(await drawer.findByText("Cet employé a des retraits.")).toBeVisible();
  });

  it("offers no add, edit or delete to a role that can only view", async () => {
    serveProjects([11, 12]);
    serveEmployeeData([apiEmployee(7)]);
    openAt("/fr/employees/projects/11?new=1", viewOnly);

    await screen.findByRole("cell", { name: "EMP-7" });
    expect(screen.queryByRole("link", { name: text.new })).toBeNull();
    expect(screen.queryByRole("link", { name: "Modifier Sidi Ahmed" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Supprimer Sidi Ahmed" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
