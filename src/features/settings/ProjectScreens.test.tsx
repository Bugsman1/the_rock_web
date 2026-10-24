import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Grinder, Project } from "@/lib/projects";
import messages from "@/messages/fr.json";
import { ProjectForm } from "./ProjectForm";
import { GrinderForm } from "./GrinderForm";

const api = vi.hoisted(() => ({
  createProject: vi.fn(),
  updateProject: vi.fn(),
  createGrinder: vi.fn(),
  updateGrinder: vi.fn(),
}));

vi.mock("@/lib/projectsApi", () => api);

const onSaved = vi.fn();
const projectText = messages.settings.projects;
const grinderText = messages.settings.grinders;
const zouerat: Project = { id: "3", name: "Zouérat 1", site: "zouerat", status: "active" };
const machine7: Grinder = { id: "9", project: "3", number: 7, status: "active" };

beforeEach(() => {
  onSaved.mockReset();
  for (const save of Object.values(api)) {
    save.mockReset();
    save.mockResolvedValue({ ok: true });
  }
});

function inFrench(children: React.ReactNode) {
  return render(
    <RouterProvider
      router={createMemoryRouter([
        {
          path: "*",
          element: (
            <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
              {children}
            </IntlProvider>
          ),
        },
      ])}
    />,
  );
}

function renderProjectForm(project?: Project) {
  return inFrench(<ProjectForm item={project} onSaved={onSaved} onCancel={vi.fn()} />);
}

function renderGrinderForm(grinder?: Grinder) {
  return inFrench(
    <GrinderForm project="3" item={grinder} nextNumber={8} onSaved={onSaved} onCancel={vi.fn()} />,
  );
}

describe("ProjectForm when adding", () => {
  it("adds the project with its name, place and status", async () => {
    const user = userEvent.setup();
    renderProjectForm();

    await user.type(screen.getByLabelText(projectText.fields.name), "Sfariyat 3");
    await user.selectOptions(
      screen.getByLabelText(projectText.fields.site),
      messages.sites.sfariyat,
    );
    await user.selectOptions(
      screen.getByLabelText(projectText.fields.status),
      messages.activityStatuses.maintenance,
    );
    await user.click(screen.getByRole("button", { name: projectText.form.create }));

    await waitFor(() => {
      expect(api.createProject).toHaveBeenCalledWith({
        name: "Sfariyat 3",
        site: "sfariyat",
        status: "maintenance",
      });
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it("requires a name", async () => {
    const user = userEvent.setup();
    renderProjectForm();

    await user.click(screen.getByRole("button", { name: projectText.form.create }));

    expect(await screen.findByText(messages.common.validation.required)).toBeVisible();
    expect(api.createProject).not.toHaveBeenCalled();
  });

  it("shows the errors the server returns and stays open", async () => {
    api.createProject.mockResolvedValue({
      ok: false,
      fieldErrors: { name: "Trop long." },
      failed: false,
    });
    const user = userEvent.setup();
    renderProjectForm();

    await user.type(screen.getByLabelText(projectText.fields.name), "Sfariyat 3");
    await user.click(screen.getByRole("button", { name: projectText.form.create }));

    expect(await screen.findByText("Trop long.")).toBeVisible();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("says when saving failed for another reason", async () => {
    api.createProject.mockResolvedValue({ ok: false, fieldErrors: {}, failed: true });
    const user = userEvent.setup();
    renderProjectForm();

    await user.type(screen.getByLabelText(projectText.fields.name), "Sfariyat 3");
    await user.click(screen.getByRole("button", { name: projectText.form.create }));

    expect(await screen.findByRole("alert")).toHaveTextContent(messages.common.saveFailed);
  });
});

describe("ProjectForm when editing", () => {
  it("starts from the saved project and saves the change", async () => {
    const user = userEvent.setup();
    renderProjectForm(zouerat);

    expect(screen.getByLabelText(projectText.fields.name)).toHaveValue("Zouérat 1");
    expect(screen.getByLabelText(projectText.fields.site)).toHaveValue("zouerat");

    await user.selectOptions(
      screen.getByLabelText(projectText.fields.status),
      messages.activityStatuses.inactive,
    );
    await user.click(screen.getByRole("button", { name: projectText.form.submit }));

    await waitFor(() => {
      expect(api.updateProject).toHaveBeenCalledWith("3", {
        name: "Zouérat 1",
        site: "zouerat",
        status: "inactive",
      });
    });
    expect(api.createProject).not.toHaveBeenCalled();
  });
});

describe("GrinderForm when adding", () => {
  it("starts empty, hints the next free number and adds the machine", async () => {
    const user = userEvent.setup();
    renderGrinderForm();

    expect(screen.getByLabelText(grinderText.fields.number)).toHaveValue(null);
    expect(screen.getByText("Prochain numéro libre : 8")).toBeVisible();

    await user.type(screen.getByLabelText(grinderText.fields.number), "8");

    await user.click(screen.getByRole("button", { name: grinderText.form.create }));

    await waitFor(() => {
      expect(api.createGrinder).toHaveBeenCalledWith(
        "3",
        { number: 8, status: "active" },
        grinderText.form.errors.numberTaken,
      );
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it("rejects an empty or invalid number", async () => {
    const user = userEvent.setup();
    renderGrinderForm();

    await user.clear(screen.getByLabelText(grinderText.fields.number));
    await user.tab();

    expect(await screen.findByText(grinderText.form.errors.numberInvalid)).toBeVisible();

    await user.type(screen.getByLabelText(grinderText.fields.number), "0");
    await user.click(screen.getByRole("button", { name: grinderText.form.create }));

    expect(await screen.findByText(grinderText.form.errors.numberInvalid)).toBeVisible();
    expect(api.createGrinder).not.toHaveBeenCalled();
  });

  it("shows a number already used in the project", async () => {
    api.createGrinder.mockResolvedValue({
      ok: false,
      fieldErrors: { number: grinderText.form.errors.numberTaken },
      failed: false,
    });
    const user = userEvent.setup();
    renderGrinderForm();

    await user.type(screen.getByLabelText(grinderText.fields.number), "7");
    await user.click(screen.getByRole("button", { name: grinderText.form.create }));

    expect(await screen.findByText(grinderText.form.errors.numberTaken)).toBeVisible();
    expect(onSaved).not.toHaveBeenCalled();
  });
});

describe("GrinderForm when editing", () => {
  it("starts from the saved machine and saves its new status", async () => {
    const user = userEvent.setup();
    renderGrinderForm(machine7);

    expect(screen.getByLabelText(grinderText.fields.number)).toHaveValue(7);

    await user.selectOptions(
      screen.getByLabelText(grinderText.fields.status),
      messages.activityStatuses.maintenance,
    );
    await user.click(screen.getByRole("button", { name: grinderText.form.submit }));

    await waitFor(() => {
      expect(api.updateGrinder).toHaveBeenCalledWith(
        "3",
        "9",
        { number: 7, status: "maintenance" },
        grinderText.form.errors.numberTaken,
      );
    });
  });
});
