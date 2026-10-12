import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { IntlProvider } from "use-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { noAccess, rightsFromApi } from "@/lib/access";
import type { Access } from "@/lib/access";
import { AccessContext } from "@/lib/accessContext";
import messages from "@/messages/fr.json";
import { RoleForm, RolesScreen, rolesLoader } from "./RolesScreen";
import { newRoleValues, roleValuesOf } from "./users";
import type { RoleDetails } from "./users";

const allRights: Access = { ...noAccess, superuser: true };

const { createRoleMock, updateRoleMock, deleteRoleMock, getRoleDetailsMock } = vi.hoisted(() => ({
  createRoleMock: vi.fn(),
  updateRoleMock: vi.fn(),
  deleteRoleMock: vi.fn(),
  getRoleDetailsMock: vi.fn(),
}));

vi.mock("./usersApi", () => ({
  createRole: createRoleMock,
  updateRole: updateRoleMock,
  deleteRole: deleteRoleMock,
  getRoleDetails: getRoleDetailsMock,
}));

const text = messages.users.roles;
const validation = messages.common.validation;
const onSaved = vi.fn();

const supervisor: RoleDetails = {
  id: "2",
  name: "supervisor",
  projectScoped: true,
  usersCount: 3,
  rights: {
    ...newRoleValues().rights,
    refining: { view: true, add: true, edit: false, delete: false },
  },
};

const refiner: RoleDetails = { ...supervisor, id: "5", name: "Raffineur", usersCount: 0 };

beforeEach(() => {
  onSaved.mockReset();
  createRoleMock.mockReset();
  createRoleMock.mockResolvedValue({ ok: true });
  updateRoleMock.mockReset();
  updateRoleMock.mockResolvedValue({ ok: true });
  deleteRoleMock.mockReset();
  getRoleDetailsMock.mockReset();
  getRoleDetailsMock.mockResolvedValue([supervisor, refiner]);
});

function rightBox(right: keyof typeof text.rights, module: keyof typeof text.modules) {
  return screen.getByLabelText(`${text.rights[right]} : ${text.modules[module]}`);
}

function renderForm(role?: RoleDetails) {
  return render(
    <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
      <RoleForm role={role} onSaved={onSaved} onCancel={vi.fn()} />
    </IntlProvider>,
  );
}

function openAt(path: string, access: Access = allRights) {
  const router = createMemoryRouter(
    [{ path: "/fr/users/roles", loader: rolesLoader, element: <RolesScreen /> }],
    { initialEntries: [path] },
  );

  render(
    <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
      <AccessContext value={access}>
        <RouterProvider router={router} />
      </AccessContext>
    </IntlProvider>,
  );

  return router;
}

describe("RoleForm", () => {
  it("adds a role with its name and the rights ticked in each section", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(text.fields.name), "Contrôleur");
    await user.click(screen.getByLabelText(text.fields.projectScoped));
    await user.click(rightBox("view", "inventory"));
    await user.click(rightBox("add", "refining"));
    await user.click(screen.getByRole("button", { name: text.form.create }));

    await waitFor(() => {
      expect(createRoleMock).toHaveBeenCalledWith({
        name: "Contrôleur",
        projectScoped: true,
        rights: {
          ...newRoleValues().rights,
          inventory: { view: true, add: false, edit: false, delete: false },
          refining: { view: false, add: true, edit: false, delete: false },
        },
      });
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it("requires a name", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: text.form.create }));

    expect(await screen.findByText(validation.required)).toBeVisible();
    expect(createRoleMock).not.toHaveBeenCalled();
  });

  it("starts from the saved rights and keeps the name of a built-in role", async () => {
    const user = userEvent.setup();
    renderForm(supervisor);

    expect(screen.queryByRole("textbox", { name: text.fields.name })).not.toBeInTheDocument();
    expect(screen.getByText(messages.roles.supervisor)).toBeVisible();
    expect(rightBox("add", "refining")).toBeChecked();
    expect(rightBox("view", "shipments")).not.toBeChecked();

    await user.click(screen.getByRole("button", { name: text.form.submit }));

    await waitFor(() => {
      expect(updateRoleMock).toHaveBeenCalledWith("2", roleValuesOf(supervisor));
    });
  });

  it("shows the errors the server returns on the name and stays open", async () => {
    createRoleMock.mockResolvedValue({
      ok: false,
      fieldErrors: { name: "Ce nom existe déjà." },
      failed: false,
    });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(text.fields.name), "manager");
    await user.click(screen.getByRole("button", { name: text.form.create }));

    expect(await screen.findByText("Ce nom existe déjà.")).toBeVisible();
    expect(onSaved).not.toHaveBeenCalled();
  });
});

describe("RolesScreen", () => {
  it("lists the roles with their sections and offers to delete only unused ones", async () => {
    openAt("/fr/users/roles");

    expect(await screen.findByText("Raffineur")).toBeVisible();
    expect(screen.getByText(messages.roles.supervisor)).toBeVisible();
    expect(
      screen.getByRole("link", {
        name: text.deleteLabel.replace("{name}", "Raffineur"),
      }),
    ).toHaveAttribute("href", "/fr/users/roles?delete=5");
    expect(
      screen.queryByRole("link", {
        name: text.deleteLabel.replace("{name}", messages.roles.supervisor),
      }),
    ).not.toBeInTheDocument();
  });

  it("shows a view-only role the roles with no way to change them", async () => {
    openAt("/fr/users/roles?delete=5", {
      superuser: false,
      rights: rightsFromApi([{ module: "accounts", can_view: true }]),
    });

    expect(await screen.findByText("Raffineur")).toBeVisible();
    expect(screen.queryByRole("link", { name: text.new })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: text.editLabel.replace("{name}", "Raffineur") }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("deletes a role after asking and goes back to the list", async () => {
    deleteRoleMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    const router = openAt("/fr/users/roles?delete=5");

    await user.click(await screen.findByRole("button", { name: text.remove.confirm }));

    expect(deleteRoleMock).toHaveBeenCalledWith("5");
    await waitFor(() => {
      expect(router.state.location.search).toBe("");
    });
  });

  it("says why a role could not be deleted", async () => {
    deleteRoleMock.mockResolvedValue({ ok: false, reason: "Ce rôle est encore utilisé." });
    const user = userEvent.setup();
    openAt("/fr/users/roles?delete=5");

    await user.click(await screen.findByRole("button", { name: text.remove.confirm }));

    expect(await screen.findByText("Ce rôle est encore utilisé.")).toBeVisible();
  });
});
