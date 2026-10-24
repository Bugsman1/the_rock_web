import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/fr.json";
import type { Project } from "@/lib/projects";
import type { Role, User } from "@/lib/users";
import { UserForm } from "./UserForm";

const { createUserMock, updateUserMock } = vi.hoisted(() => ({
  createUserMock: vi.fn(),
  updateUserMock: vi.fn(),
}));

vi.mock("./usersApi", () => ({
  createUser: createUserMock,
  updateUser: updateUserMock,
}));

const onSaved = vi.fn();

beforeEach(() => {
  onSaved.mockReset();
  createUserMock.mockReset();
  createUserMock.mockResolvedValue({ ok: true });
  updateUserMock.mockReset();
  updateUserMock.mockResolvedValue({ ok: true });
});

const fields = messages.users.fields;
const form = messages.users.form;
const validation = messages.common.validation;

const manager: Role = {
  id: "1",
  name: "manager",
  projectScoped: false,
};

const supervisor: Role = { ...manager, id: "2", name: "supervisor", projectScoped: true };

const refiner: Role = { ...manager, id: "5", name: "Raffineur", projectScoped: true };

const roles = [manager, supervisor, refiner];

const aicha: User = {
  id: "4",
  name: "Aicha Mint Mohamed",
  email: "aicha@mills.mr",
  phone: "+222 22 41 18 30",
  role: supervisor,
  project: "2",
};

const projects: readonly Project[] = [
  { id: "1", name: "Zouérat 1", site: "zouerat", status: "active" },
  { id: "2", name: "Zouérat 2", site: "zouerat", status: "active" },
  { id: "3", name: "Sfariyat 1", site: "sfariyat", status: "maintenance" },
];

function renderForm(user?: User) {
  return render(
    <RouterProvider
      router={createMemoryRouter([
        {
          path: "*",
          element: (
            <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
              <UserForm
                user={user}
                projects={projects}
                roles={roles}
                onSaved={onSaved}
                onCancel={vi.fn()}
              />
            </IntlProvider>
          ),
        },
      ])}
    />,
  );
}

async function replace(label: string, value: string) {
  const user = userEvent.setup();
  const input = screen.getByLabelText(label);
  await user.clear(input);
  if (value !== "") await user.type(input, value);
  await user.tab();
  return user;
}

async function fillNewUser(role = "Raffineur") {
  await userEvent.setup().selectOptions(screen.getByLabelText(fields.role), role);
  await replace(fields.name, "Sidi Salem");
  await replace(fields.email, "sidi@mills.mr");
  await replace(fields.phone, "46109325");
  const user = await replace(fields.password, "secret123");
  await user.selectOptions(screen.getByLabelText(fields.project), "Sfariyat 1");
  return user;
}

describe("UserForm when adding", () => {
  it("starts empty with no role chosen", () => {
    renderForm();

    expect(screen.getByLabelText(fields.name)).toHaveValue("");
    expect(screen.getByLabelText(fields.email)).toHaveValue("");
    expect(screen.getByLabelText(fields.role)).toHaveValue("");
    expect(screen.getByLabelText(fields.password)).toHaveValue("");
    expect(screen.queryByLabelText(fields.project)).not.toBeInTheDocument();
  });

  it("adds a user of a project-scoped role with their project", async () => {
    renderForm();

    const user = await fillNewUser();
    await user.click(screen.getByRole("button", { name: form.create }));

    await waitFor(() => {
      expect(createUserMock).toHaveBeenCalledWith(
        {
          name: "Sidi Salem",
          email: "sidi@mills.mr",
          phone: "46109325",
          role: "5",
          password: "secret123",
          project: "3",
        },
        roles,
      );
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it("asks no project for a role that sees every project", async () => {
    renderForm();

    const user = await fillNewUser();
    await user.selectOptions(screen.getByLabelText(fields.role), messages.roles.manager);

    expect(screen.queryByLabelText(fields.project)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: form.create }));

    await waitFor(() => {
      expect(createUserMock).toHaveBeenCalledWith(expect.objectContaining({ role: "1" }), roles);
    });
  });

  it("requires a project for a project-scoped role", async () => {
    renderForm();

    await userEvent.setup().selectOptions(screen.getByLabelText(fields.role), "Raffineur");
    await replace(fields.name, "Sidi Salem");
    await replace(fields.email, "sidi@mills.mr");
    await replace(fields.phone, "46109325");
    const user = await replace(fields.password, "secret123");
    await user.click(screen.getByRole("button", { name: form.create }));

    expect(await screen.findByText(form.errors.projectRequired)).toBeVisible();
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it("flags every empty required field on submit", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: form.create }));

    expect(await screen.findAllByText(validation.required)).toHaveLength(5);
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid email and a short password", async () => {
    renderForm();

    await replace(fields.email, "sidi@");
    await replace(fields.password, "abc");

    expect(await screen.findByText(form.errors.emailInvalid)).toBeVisible();
    expect(screen.getByText(form.errors.passwordShort.replace("{min}", "8"))).toBeVisible();
  });

  it("shows the errors the server returns on their fields and stays open", async () => {
    createUserMock.mockResolvedValue({
      ok: false,
      fieldErrors: { email: "Cet e-mail existe déjà." },
      failed: false,
    });
    renderForm();

    const user = await fillNewUser();
    await user.click(screen.getByRole("button", { name: form.create }));

    expect(await screen.findByText("Cet e-mail existe déjà.")).toBeVisible();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("says when saving failed for another reason", async () => {
    createUserMock.mockResolvedValue({ ok: false, fieldErrors: {}, failed: true });
    renderForm();

    const user = await fillNewUser();
    await user.click(screen.getByRole("button", { name: form.create }));

    expect(await screen.findByRole("alert")).toHaveTextContent(messages.common.saveFailed);
    expect(onSaved).not.toHaveBeenCalled();
  });
});

describe("UserForm when editing", () => {
  it("starts from the saved user, with an empty new password", () => {
    renderForm(aicha);

    expect(screen.getByLabelText(fields.name)).toHaveValue("Aicha Mint Mohamed");
    expect(screen.getByLabelText(fields.email)).toHaveValue("aicha@mills.mr");
    expect(screen.getByLabelText(fields.phone)).toHaveValue("+222 22 41 18 30");
    expect(screen.getByLabelText(fields.role)).toHaveValue("2");
    expect(screen.getByLabelText(fields.newPassword)).toHaveValue("");
    expect(screen.getByLabelText(fields.project)).toHaveValue("2");
  });

  it("saves without a password to keep the current one", async () => {
    const user = userEvent.setup();
    renderForm(aicha);

    await user.click(screen.getByRole("button", { name: form.submit }));

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith(
        "4",
        {
          name: "Aicha Mint Mohamed",
          email: "aicha@mills.mr",
          phone: "+222 22 41 18 30",
          role: "2",
          password: "",
          project: "2",
        },
        roles,
      );
    });
    expect(createUserMock).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
  });

  it("requires a name", async () => {
    renderForm(aicha);

    await replace(fields.name, "");

    expect(await screen.findByText(validation.required)).toBeVisible();
  });
});
