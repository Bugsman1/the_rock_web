import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslations } from "use-intl";
import { useToast } from "@/components/ui/Toast";
import { DrawerActions } from "@/components/ui/Drawer";
import { SaveFailureMessage, useSaveFailure } from "@/components/ui/FieldError";
import { PasswordField } from "@/components/ui/PasswordField";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { PHONE_PLACEHOLDER, sanitizePhone } from "@/lib/phone";
import type { Project } from "@/lib/projects";
import { roleLabel } from "@/lib/users";
import type { Role, User } from "@/lib/users";
import { createUserSchema, isUserField, PASSWORD_MIN_LENGTH } from "./users";
import type { UserValues } from "./users";
import { createUser, updateUser } from "./usersApi";

type UserFormProps = {
  user?: User;
  projects: readonly Project[];
  roles: readonly Role[];
  onSaved: () => void;
  onCancel: () => void;
};

export function UserForm({ user, projects, roles: roleChoices, onSaved, onCancel }: UserFormProps) {
  const t = useTranslations("users");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const toast = useToast();
  const roles = useTranslations("roles");
  const saveFailure = useSaveFailure();
  const creating = user === undefined;

  const schema = useMemo(
    () =>
      createUserSchema(
        {
          required: common("validation.required"),
          emailInvalid: t("form.errors.emailInvalid"),
          phoneInvalid: common("validation.phoneInvalid"),
          passwordShort: t("form.errors.passwordShort", { min: PASSWORD_MIN_LENGTH }),
          projectRequired: t("form.errors.projectRequired"),
        },
        {
          passwordRequired: creating,
          isProjectScoped: (roleId) =>
            roleChoices.some((choice) => choice.id === roleId && choice.projectScoped),
        },
      ),
    [common, t, creating, roleChoices],
  );

  const { control, register, handleSubmit, formState, setError } = useForm<UserValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues: {
      name: user?.name ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
      role: user?.role?.id ?? "",
      password: "",
      project: user?.project ?? "",
    },
  });

  const { errors } = formState;
  const roleId = useWatch({ control, name: "role" });
  const projectScoped = roleChoices.some((choice) => choice.id === roleId && choice.projectScoped);

  async function onSubmit(values: UserValues) {
    if (saveFailure.unknown) {
      return;
    }

    saveFailure.clear();

    const result =
      user === undefined
        ? await createUser(values, roleChoices)
        : await updateUser(user.id, values, roleChoices);

    if (result.ok) {
      toast(creating ? toasts("userAdded") : toasts("userUpdated"));
      onSaved();
      return;
    }

    for (const [field, message] of Object.entries(result.fieldErrors)) {
      if (isUserField(field)) {
        setError(field, { message });
      }
    }

    saveFailure.report(result);
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <TextField
        id="user-name"
        label={t("fields.name")}
        required
        autoComplete="off"
        error={errors.name?.message}
        {...register("name")}
      />

      <TextField
        id="user-email"
        type="email"
        dir="ltr"
        label={t("fields.email")}
        required
        autoComplete="off"
        error={errors.email?.message}
        {...register("email")}
      />

      <Controller
        control={control}
        name="phone"
        render={({ field }) => (
          <TextField
            id="user-phone"
            type="tel"
            inputMode="tel"
            dir="ltr"
            label={t("fields.phone")}
            required
            placeholder={PHONE_PLACEHOLDER}
            autoComplete="off"
            error={errors.phone?.message}
            {...field}
            onChange={(event) => field.onChange(sanitizePhone(event.target.value))}
          />
        )}
      />

      <Select
        id="user-role"
        label={t("fields.role")}
        required
        placeholder={t("chooseRole")}
        options={roleChoices.map((choice) => ({
          value: choice.id,
          label: roleLabel(choice.name, (name) => roles(name)),
        }))}
        error={errors.role?.message}
        {...register("role")}
      />

      {projectScoped ? (
        <Select
          id="user-project"
          label={t("fields.project")}
          required
          placeholder={t("chooseProject")}
          options={projects.map((project) => ({ value: project.id, label: project.name }))}
          error={errors.project?.message}
          {...register("project")}
        />
      ) : null}

      <PasswordField
        id="user-password"
        dir="ltr"
        label={creating ? t("fields.password") : t("fields.newPassword")}
        required={creating}
        placeholder={creating ? undefined : t("passwordKeep")}
        autoComplete="new-password"
        showLabel={common("showPassword")}
        hideLabel={common("hidePassword")}
        error={errors.password?.message}
        {...register("password")}
      />

      <SaveFailureMessage failure={saveFailure.failure} />

      <DrawerActions
        dirty={formState.isDirty}
        locked={saveFailure.unknown}
        submitting={formState.isSubmitting}
        submitIcon={creating ? "plus" : "circle-check"}
        submitLabel={creating ? t("form.create") : t("form.submit")}
        savingLabel={t("form.saving")}
        cancelLabel={common("cancel")}
        onCancel={onCancel}
      />
    </form>
  );
}
