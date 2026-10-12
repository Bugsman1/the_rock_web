import { describe, expect, it } from "vitest";
import { createUserSchema, isUserField, userErrorsFromApi, userToApi } from "./users";
import type { UserValues } from "./users";

const input: UserValues = {
  name: " Aicha Mint Mohamed ",
  email: " Aicha@Mills.mr ",
  phone: "22411830",
  role: "supervisor",
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

describe("createUserSchema", () => {
  it("accepts a complete supervisor", () => {
    expect(createUserSchema(messages, { passwordRequired: true }).safeParse(input).success).toBe(
      true,
    );
  });

  it("requires a password only when adding a user", () => {
    const keepPassword = { ...input, password: "" };

    expect(
      createUserSchema(messages, { passwordRequired: true }).safeParse(keepPassword).error
        ?.issues[0]?.message,
    ).toBe("required");
    expect(
      createUserSchema(messages, { passwordRequired: false }).safeParse(keepPassword).success,
    ).toBe(true);
  });

  it("refuses a short password and a supervisor without project", () => {
    const result = createUserSchema(messages, { passwordRequired: true }).safeParse({
      ...input,
      password: "short",
      project: "",
    });

    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      "passwordShort",
      "projectRequired",
    ]);
  });

  it("asks no project for a manager", () => {
    expect(
      createUserSchema(messages, { passwordRequired: true }).safeParse({
        ...input,
        role: "manager",
        project: "",
      }).success,
    ).toBe(true);
  });
});

describe("userToApi", () => {
  it("sends the full name, a lowercase email, the standard phone, role and project ids", () => {
    expect(userToApi(input, 2)).toEqual({
      full_name: "Aicha Mint Mohamed",
      email: "aicha@mills.mr",
      phone: "+222 22 41 18 30",
      role: 2,
      project: 3,
      password: "secret123",
    });
  });

  it("sends no project for a manager and no password when it is empty", () => {
    const body = userToApi({ ...input, role: "manager", password: "" }, 1);

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
