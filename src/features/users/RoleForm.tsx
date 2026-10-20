import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslations } from "use-intl";
import { useToast } from "@/components/ui/Toast";
import { Checkbox } from "@/components/ui/Checkbox";
import { DrawerActions } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FieldError";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { tableCellClasses, tableHeadClasses } from "@/components/ui/TablePanel";
import { TextField } from "@/components/ui/TextField";
import { modules, rights } from "@/lib/access";
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
  const [failed, setFailed] = useState(false);

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
    setFailed(false);

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

    setFailed(result.failed);
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
          <table className="w-full border-collapse">
            <thead className="bg-surface-page">
              <tr className="border-line border-b-[1.5px]">
                <th className={tableHeadClasses}>{t("fields.section")}</th>
                {rights.map((right) => (
                  <th key={right} className={tableHeadClasses}>
                    {t(`rights.${right}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modules.map((module) => (
                <tr key={module} className="border-line-subtle border-b last:border-b-0">
                  <td className={`${tableCellClasses} text-ink font-semibold`}>
                    {t(`modules.${module}`)}
                  </td>
                  {rights.map((right) => (
                    <td key={right} className="px-4 py-1">
                      <Checkbox
                        id={`role-${module}-${right}`}
                        label={t("form.rightLabel", {
                          right: t(`rights.${right}`),
                          section: t(`modules.${module}`),
                        })}
                        hideLabel
                        {...register(`rights.${module}.${right}`)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-ink-muted text-[13px] font-semibold">{t("form.viewHint")}</p>
      </fieldset>

      {failed ? <FormError message={common("saveFailed")} /> : null}

      <DrawerActions
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
