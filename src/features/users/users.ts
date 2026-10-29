import { z } from "zod";
import { emptyRights, modules, rightsFromApi } from "@/lib/access";
import type { Rights } from "@/lib/access";
import type { ApiSchema, BackendFieldErrors, FieldErrors } from "@/lib/api/client";
import { isValidPhone, phoneToApi } from "@/lib/phone";
import { isRecordId } from "@/lib/projects";

export const PASSWORD_MIN_LENGTH = 8;

const NAME_MAX_LENGTH = 150;
const ROLE_NAME_MAX_LENGTH = 100;

type ValidationMessages = {
  required: string;
  emailInvalid: string;
  phoneInvalid: string;
  passwordShort: string;
  projectRequired: string;
};

type UserSchemaOptions = {
  passwordRequired: boolean;
  isProjectScoped: (roleId: string) => boolean;
};

export function createUserSchema(
  messages: ValidationMessages,
  { passwordRequired, isProjectScoped }: UserSchemaOptions,
) {
  return z
    .object({
      name: z.string().trim().min(1, messages.required).max(NAME_MAX_LENGTH),
      email: z
        .string()
        .trim()
        .min(1, { message: messages.required, abort: true })
        .pipe(z.email({ message: messages.emailInvalid })),
      phone: z
        .string()
        .trim()
        .min(1, { message: messages.required, abort: true })
        .refine(isValidPhone, messages.phoneInvalid),
      role: z.string().min(1, messages.required),
      password: z
        .string()
        .refine((value) => !passwordRequired || value !== "", {
          message: messages.required,
          abort: true,
        })
        .refine(
          (value) => value === "" || value.length >= PASSWORD_MIN_LENGTH,
          messages.passwordShort,
        ),
      project: z.string(),
    })
    .refine((user) => !isProjectScoped(user.role) || isRecordId(user.project), {
      message: messages.projectRequired,
      path: ["project"],
      when: ({ issues }) =>
        issues.every((issue) => issue.path?.[0] !== "role" && issue.path?.[0] !== "project"),
    });
}

export type UserValues = z.infer<ReturnType<typeof createUserSchema>>;

const userFields: readonly (keyof UserValues)[] = [
  "name",
  "email",
  "phone",
  "role",
  "password",
  "project",
];

export function isUserField(value: string): value is keyof UserValues {
  return userFields.some((field) => field === value);
}

export function userToApi(
  { name, email, phone, role, password, project }: UserValues,
  projectScoped: boolean,
) {
  return {
    full_name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: phoneToApi(phone),
    role: Number(role),
    project: projectScoped ? Number(project) : null,
    ...(password === "" ? {} : { password }),
  };
}

export function userErrorsFromApi(errors: BackendFieldErrors): FieldErrors<keyof UserValues> {
  return {
    ...(errors.full_name === undefined ? {} : { name: errors.full_name }),
    ...(errors.email === undefined ? {} : { email: errors.email }),
    ...(errors.phone === undefined ? {} : { phone: errors.phone }),
    ...(errors.role === undefined ? {} : { role: errors.role }),
    ...(errors.password === undefined ? {} : { password: errors.password }),
    ...(errors.project === undefined ? {} : { project: errors.project }),
  };
}

export type RoleDetails = {
  id: string;
  name: string;
  projectScoped: boolean;
  usersCount: number;
  rights: Rights;
};

export function roleDetailsFromApi(role: ApiSchema<"Role">): RoleDetails {
  return {
    id: String(role.id),
    name: role.name,
    projectScoped: role.is_project_scoped ?? false,
    usersCount: role.users_count,
    rights: rightsFromApi(role.permissions ?? []),
  };
}

const moduleRightsSchema = z.object({
  view: z.boolean(),
  add: z.boolean(),
  edit: z.boolean(),
  delete: z.boolean(),
});

export function createRoleSchema(messages: { required: string }) {
  return z.object({
    name: z.string().trim().min(1, messages.required).max(ROLE_NAME_MAX_LENGTH),
    projectScoped: z.boolean(),
    rights: z.object({
      shipments: moduleRightsSchema,
      grinding: moduleRightsSchema,
      refining: moduleRightsSchema,
      inventory: moduleRightsSchema,
      customers: moduleRightsSchema,
      debts: moduleRightsSchema,
      settlements: moduleRightsSchema,
      employees: moduleRightsSchema,
      accounts: moduleRightsSchema,
      locations: moduleRightsSchema,
    }),
  });
}

export type RoleValues = z.infer<ReturnType<typeof createRoleSchema>>;

export function newRoleValues(): RoleValues {
  return { name: "", projectScoped: false, rights: emptyRights() };
}

export function roleValuesOf(role: RoleDetails): RoleValues {
  return { name: role.name, projectScoped: role.projectScoped, rights: role.rights };
}

export function roleToApi(values: RoleValues) {
  return {
    name: values.name,
    is_project_scoped: values.projectScoped,
    permissions: modules.flatMap((module) => {
      const granted = values.rights[module];
      const anything = granted.view || granted.add || granted.edit || granted.delete;

      return anything
        ? [
            {
              module,
              can_view: true,
              can_add: granted.add,
              can_edit: granted.edit,
              can_delete: granted.delete,
              can_approve: granted.edit,
            },
          ]
        : [];
    }),
  };
}

export function roleErrorsFromApi(errors: BackendFieldErrors): FieldErrors<keyof RoleValues> {
  return {
    ...(errors.name === undefined ? {} : { name: errors.name }),
    ...(errors.is_project_scoped === undefined ? {} : { projectScoped: errors.is_project_scoped }),
  };
}
