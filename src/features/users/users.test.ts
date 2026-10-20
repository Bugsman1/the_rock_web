import { describe, expect, it } from "vitest";
import type { ApiSchema } from "@/lib/api/client";
import {
  createRoleSchema,
  createUserSchema,
  isUserField,
  newRoleValues,
  roleDetailsFromApi,
  roleErrorsFromApi,
  roleToApi,
  roleValuesOf,
  userErrorsFromApi,
  userToApi,
} from "./users";
import type { UserValues } from "./users";

const input: UserValues = {
  name: " Aicha Mint Mohamed ",
  email: " Aicha@Mills.mr ",
  phone: "22411830",
  role: "2",
  password: "secret123",
  project: "3",
};

const messages = {
  required: "required",
  emailInvalid: "emailInvalid",
  phoneInvalid: "phoneInvalid",
  passwordShort: "passwordShort",
  projectRequired: "projectRequired",
};

const adding = { passwordRequired: true, isProjectScoped: (role: string) => role === "2" };

describe("createUserSchema", () => {
  it("accepts a complete user of a project-scoped role", () => {
    expect(createUserSchema(messages, adding).safeParse(input).success).toBe(true);
  });

  it("requires a password only when adding a user", () => {
    const keepPassword = { ...input, password: "" };

    expect(
      createUserSchema(messages, adding).safeParse(keepPassword).error?.issues[0]?.message,
    ).toBe("required");
    expect(
      createUserSchema(messages, { ...adding, passwordRequired: false }).safeParse(keepPassword)
        .success,
    ).toBe(true);
  });

  it("refuses a short password and a project-scoped user without project", () => {
    const result = createUserSchema(messages, adding).safeParse({
      ...input,
      password: "short",
      project: "",
    });

    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      "passwordShort",
      "projectRequired",
    ]);
  });

  it("asks no project for a role that sees every project", () => {
    expect(
      createUserSchema(messages, adding).safeParse({
        ...input,
        role: "1",
        project: "",
      }).success,
    ).toBe(true);
  });
});

describe("userToApi", () => {
  it("sends the full name, a lowercase email, the phone without spaces, role and project ids", () => {
    expect(userToApi(input, true)).toEqual({
      full_name: "Aicha Mint Mohamed",
      email: "aicha@mills.mr",
      phone: "+22222411830",
      role: 2,
      project: 3,
      password: "secret123",
    });
  });

  it("sends no project for a role that sees every project and no empty password", () => {
    const body = userToApi({ ...input, role: "1", password: "" }, false);

    expect(body.project).toBeNull();
    expect(body).not.toHaveProperty("password");
  });
});

describe("userErrorsFromApi", () => {
  it("puts the backend errors on our fields", () => {
    expect(
      userErrorsFromApi({
        full_name: "Trop long.",
        email: "Déjà utilisé.",
        project: "Requis.",
        other: "x",
      }),
    ).toEqual({ name: "Trop long.", email: "Déjà utilisé.", project: "Requis." });
  });
});

describe("isUserField", () => {
  it("knows the form fields only", () => {
    expect(isUserField("project")).toBe(true);
    expect(isUserField("username")).toBe(false);
  });
});

const apiRole: ApiSchema<"Role"> = {
  id: 5,
  name: "Raffineur",
  is_project_scoped: true,
  users_count: 2,
  permissions: [
    { module: "refining", can_view: true, can_add: true, can_edit: true, can_delete: false },
    { module: "inventory", can_view: true },
  ],
};

describe("roleDetailsFromApi", () => {
  it("keeps the rights of each section and leaves the others closed", () => {
    const role = roleDetailsFromApi(apiRole);

    expect(role).toMatchObject({ id: "5", name: "Raffineur", projectScoped: true, usersCount: 2 });
    expect(role.rights.refining).toEqual({ view: true, add: true, edit: true, delete: false });
    expect(role.rights.inventory).toEqual({ view: true, add: false, edit: false, delete: false });
    expect(role.rights.shipments).toEqual({ view: false, add: false, edit: false, delete: false });
  });
});

describe("createRoleSchema", () => {
  it("requires a name", () => {
    expect(
      createRoleSchema({ required: "required" }).safeParse({ ...newRoleValues(), name: "  " }).error
        ?.issues[0]?.message,
    ).toBe("required");
  });
});

describe("roleToApi", () => {
  it("sends only the sections the role has a right on, which can always be viewed", () => {
    const values = roleValuesOf(roleDetailsFromApi(apiRole));
    values.rights.shipments = { view: false, add: true, edit: false, delete: false };

    expect(roleToApi(values)).toEqual({
      name: "Raffineur",
      is_project_scoped: true,
      permissions: [
        {
          module: "shipments",
          can_view: true,
          can_add: true,
          can_edit: false,
          can_delete: false,
          can_approve: false,
        },
        {
          module: "refining",
          can_view: true,
          can_add: true,
          can_edit: true,
          can_delete: false,
          can_approve: true,
        },
        {
          module: "inventory",
          can_view: true,
          can_add: false,
          can_edit: false,
          can_delete: false,
          can_approve: false,
        },
      ],
    });
  });

  it("sends no permission for a role without rights", () => {
    expect(roleToApi({ ...newRoleValues(), name: "Vide" }).permissions).toEqual([]);
  });
});

describe("roleErrorsFromApi", () => {
  it("puts the backend errors on our fields", () => {
    expect(roleErrorsFromApi({ name: "Existe déjà.", permissions: "x" })).toEqual({
      name: "Existe déjà.",
    });
  });
});
