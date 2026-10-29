import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  cellsOf,
  money,
  common,
  openAt,
  serveEmployees,
  serveProjects,
  text,
} from "./employeesTesting";

serveEmployees();

function rowOf(matricule: string) {
  const row = screen.getByRole("cell", { name: matricule }).closest("tr");

  if (row === null) {
    throw new Error(`no row ${matricule}`);
  }

  return row;
}

describe("employees overview", () => {
  it("shows each project with its employees and what they are owed", async () => {
    serveProjects([11, 12]);
    openAt("/fr/employees");

    const card = (await screen.findByRole("heading", { name: "Projet Projet 11" })).closest(
      "section",
    );

    if (card === null) {
      throw new Error("card missing");
    }

    expect(within(card).getByText(text.employeeCount).nextSibling).toHaveTextContent("3");
    expect(within(card).getByText(text.totalOwed).nextSibling).toHaveTextContent(money(261000));
  });

  it("goes straight to the only project in service", async () => {
    serveProjects([13]);
    const router = openAt("/fr/employees");

    await screen.findByRole("heading", { name: text.listTitle });
    expect(router.state.location.pathname).toBe("/fr/employees/projects/13");
    expect(screen.queryByRole("link", { name: common.back })).toBeNull();
  });
});

describe("a project's employees", () => {
  it("lists every employee with what is owed, a debt in red with a minus", async () => {
    serveProjects([14]);
    openAt("/fr/employees/projects/14");

    await screen.findByRole("cell", { name: "EMP-003" });
    expect(cellsOf(rowOf("EMP-003")).slice(0, 7)).toEqual([
      "EMP-003",
      "أحمد ولد إبراهيم",
      text.jobs.refiner,
      "+222 46 10 93 25",
      money(15000),
      "01/09/2026",
      money(-6000),
    ]);
    expect(within(rowOf("EMP-003")).getByText(money(-6000))).toHaveClass("text-danger-700");
    expect(within(rowOf("EMP-001")).getByText(money(218000))).toHaveClass("text-ink");
    expect(within(rowOf("EMP-001")).getByRole("link", { name: "EMP-001" })).toHaveAttribute(
      "href",
      "/fr/employees/1401",
    );
  });

  it("finds an employee by matricule, name, job or phone", async () => {
    serveProjects([15]);
    const user = userEvent.setup();
    openAt("/fr/employees/projects/15");

    await user.type(await screen.findByRole("searchbox"), "superv");

    expect(screen.getByRole("cell", { name: "EMP-002" })).toBeVisible();
    expect(screen.queryByRole("cell", { name: "EMP-001" })).toBeNull();
  });

  it("adds an employee, after refusing an incomplete form", async () => {
    serveProjects([16]);
    const user = userEvent.setup();
    openAt("/fr/employees/projects/16?new=1");

    const drawer = within(await screen.findByRole("dialog", { name: text.form.newTitle }));
    await user.click(drawer.getByRole("button", { name: text.form.create }));
    expect(drawer.getAllByText(common.validation.required).length).toBeGreaterThan(0);
    expect(drawer.getByText(text.errors.salaryInvalid)).toBeVisible();

    await user.type(drawer.getByLabelText(text.fields.matricule), "EMP-010");
    await user.type(drawer.getByLabelText(text.fields.name), "Mariem");
    await user.selectOptions(drawer.getByLabelText(text.fields.job), "supervisor");
    await user.type(drawer.getByLabelText(text.fields.phone), "36520714");
    await user.type(drawer.getByLabelText(text.fields.monthlySalary), "18000");
    await user.type(drawer.getByLabelText(text.fields.startedOn), "01/10/2026");
    await user.click(drawer.getByRole("button", { name: text.form.create }));

    expect(await screen.findByRole("cell", { name: "EMP-010" })).toBeVisible();
    expect(cellsOf(rowOf("EMP-010")).slice(1, 4)).toEqual([
      "Mariem",
      text.jobs.supervisor,
      "+222 36 52 07 14",
    ]);
  });

  it("deletes an employee only after confirming", async () => {
    serveProjects([17]);
    const user = userEvent.setup();
    openAt("/fr/employees/projects/17");

    await screen.findByRole("cell", { name: "EMP-002" });
    await user.click(within(rowOf("EMP-002")).getByRole("link", { name: `Supprimer Sidi Ahmed` }));

    const drawer = within(await screen.findByRole("dialog", { name: text.remove.title }));
    expect(drawer.getByText(text.remove.question.replace("{name}", "Sidi Ahmed"))).toBeVisible();
    await user.click(drawer.getByRole("button", { name: text.remove.confirm }));

    await waitFor(() => expect(screen.queryByRole("cell", { name: "EMP-002" })).toBeNull());
    expect(screen.getByRole("cell", { name: "EMP-001" })).toBeVisible();
  });
});
