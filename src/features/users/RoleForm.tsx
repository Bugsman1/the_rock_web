import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslations } from "use-intl";
import { useToast } from "@/components/ui/Toast";
import { Checkbox } from "@/components/ui/Checkbox";
import { DrawerActions } from "@/components/ui/Drawer";
import { SaveFailureMessage, useSaveFailure } from "@/components/ui/FieldError";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { DataTable } from "@/components/ui/DataTable";
import { TextField } from "@/components/ui/TextField";
import { modules, rights } from "@/lib/access";
import type { Module } from "@/lib/access";
import { builtInRoleNames, roleLabel } from "@/lib/users";
import { createRoleSchema, newRoleValues, roleValuesOf } from "./users";
import type { RoleDetails, RoleValues } from "./users";
import { createRole, updateRole } from "./usersApi";

export function useRoleName() {
  const roles = useTranslations("roles");

  return (role: RoleDetails) => roleLabel(role.name, (name) => roles(name));
}

const roleFields: readonly (keyof RoleValues)[] = ["name", "projectScoped"];

function isRoleField(value: string): value is keyof RoleValues {
  return roleFields.some((field) => field === value);
}

function isBuiltIn(role: RoleDetails | undefined): boolean {
  return role !== undefined && builtInRoleNames.some((name) => name === role.name);
}

type RoleFormProps = {
  role?: RoleDetails;
  onSaved: () => void;
  onCancel: () => void;
};

export function RoleForm({ role, onSaved, onCancel }: RoleFormProps) {
  const t = useTranslations("users.roles");
  const common = useTranslations("common");
  const toasts = useTranslations("toasts");
  const toast = useToast();
  const nameOf = useRoleName();
  const saveFailure = useSaveFailure();

  const schema = useMemo(
    () => createRoleSchema({ required: common("validation.required") }),
    [common],
  );

  const { register, handleSubmit, formState, setError } = useForm<RoleValues>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues: role === undefined ? newRoleValues() : roleValuesOf(role),
  });

  const { errors } = formState;

  async function onSubmit(values: RoleValues) {
    if (saveFailure.unknown) {
      return;
    }

    saveFailure.clear();

    const result =
      role === undefined ? await createRole(values) : await updateRole(role.id, values);

    if (result.ok) {
      toast(role === undefined ? toasts("roleAdded") : toasts("roleUpdated"));
      onSaved();
      return;
    }

    for (const [field, message] of Object.entries(result.fieldErrors)) {
      if (isRoleField(field)) {
        setError(field, { message });
      }
    }

    saveFailure.report(result);
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {isBuiltIn(role) && role !== undefined ? (
        <ReadOnlyField label={t("fields.name")} value={nameOf(role)} />
      ) : (
        <TextField
          id="role-name"
          label={t("fields.name")}
          required
          autoComplete="off"
          error={errors.name?.message}
          {...register("name")}
        />
      )}

      <div className="flex flex-col gap-1">
        <Checkbox
          id="role-project-scoped"
          label={t("fields.projectScoped")}
          {...register("projectScoped")}
        />
        <p className="text-ink-muted text-[13px] font-semibold">{t("form.projectScopedHint")}</p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-ink-label mb-2 text-[14px] font-semibold">
          {t("form.permissions")}
        </legend>
        <div className="border-line rounded-field overflow-x-auto border-[1.5px]">
          <DataTable
            columns={[
              {
                key: "section",
                header: t("fields.section"),
                className: "text-ink font-semibold",
                cell: (module: Module) => t(`modules.${module}`),
              },
              ...rights.map((right) => ({
                key: right,
                header: t(`rights.${right}`),
                cell: (module: Module) => (
                  <Checkbox
                    id={`role-${module}-${right}`}
                    label={t("form.rightLabel", {
                      right: t(`rights.${right}`),
                      section: t(`modules.${module}`),
                    })}
                    hideLabel
                    {...register(`rights.${module}.${right}`)}
                  />
                ),
              })),
            ]}
            rows={modules}
            rowKey={(module) => module}
            empty=""
          />
        </div>
        <p className="text-ink-muted text-[13px] font-semibold">{t("form.viewHint")}</p>
      </fieldset>

      <SaveFailureMessage failure={saveFailure.failure} />

      <DrawerActions
        dirty={formState.isDirty}
        locked={saveFailure.unknown}
        submitting={formState.isSubmitting}
        submitIcon={role === undefined ? "plus" : "circle-check"}
        submitLabel={role === undefined ? t("form.create") : t("form.submit")}
        savingLabel={t("form.saving")}
        cancelLabel={common("cancel")}
        onCancel={onCancel}
      />
    </form>
  );
}
