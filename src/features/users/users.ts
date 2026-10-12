import { z } from "zod";
import { userRoles } from "@/lib/access";
import type { BackendFieldErrors, FieldErrors } from "@/lib/api/client";
import { formatPhone, isValidPhone } from "@/lib/phone";
import { isRecordId } from "@/lib/projects";

export const PASSWORD_MIN_LENGTH = 8;

const NAME_MAX_LENGTH = 150;

type ValidationMessages = {
  required: string;
  emailInvalid: string;
  phoneInvalid: string;
  passwordShort: string;
  projectRequired: string;
};

type UserSchemaOptions = {
  passwordRequired: boolean;
};

export function createUserSchema(
  messages: ValidationMessages,
  { passwordRequired }: UserSchemaOptions,
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
      role: z.enum(userRoles),
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
    .refine((user) => user.role === "manager" || isRecordId(user.project), {
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
  roleId: number,
) {
  return {
    full_name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: formatPhone(phone),
    role: roleId,
    project: role === "supervisor" ? Number(project) : null,
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
