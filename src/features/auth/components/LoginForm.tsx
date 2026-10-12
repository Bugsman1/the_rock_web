import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "use-intl";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Icon } from "@/components/ui/Icon";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { LoadingDots } from "@/components/ui/LoadingDots";
import { PasswordField } from "@/components/ui/PasswordField";
import { TextField } from "@/components/ui/TextField";
import { Link, useReplace } from "@/i18n/navigation";
import { homeHref } from "@/lib/access";
import { signIn } from "../signIn";
import type { SignInFailure } from "../signIn";
import { createLoginSchema } from "../schemas/loginSchema";
import type { LoginValues } from "../schemas/loginSchema";

const FORGOT_PASSWORD_PATH = "/forgot-password";

export function LoginForm() {
  const t = useTranslations("auth.login");
  const common = useTranslations("common");
  const replace = useReplace();
  const [failure, setFailure] = useState<SignInFailure>();
  const [signedIn, setSignedIn] = useState(false);

  const schema = useMemo(
    () =>
      createLoginSchema({
        emailRequired: t("errors.emailRequired"),
        emailInvalid: t("errors.emailInvalid"),
        passwordRequired: t("errors.passwordRequired"),
      }),
    [t],
  );

  const { register, handleSubmit, formState } = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  async function onSubmit(values: LoginValues) {
    setFailure(undefined);

    const result = await signIn(values);

    if (result.ok) {
      setSignedIn(true);
      replace(homeHref(result.role));
    } else {
      setFailure(result.reason);
    }
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-card bg-surface shadow-card flex w-full max-w-105 flex-col gap-5.5 px-9 py-10"
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-ink text-[28px] font-bold">{t("title")}</h1>
        <p className="text-ink-muted text-[15px]">{t("subtitle")}</p>
      </div>

      <TextField
        id="email"
        type="email"
        autoComplete="email"
        icon="user"
        label={t("email.label")}
        placeholder={t("email.placeholder")}
        error={formState.errors.email?.message}
        {...register("email")}
      />

      <PasswordField
        id="password"
        autoComplete="current-password"
        label={t("password.label")}
        placeholder={t("password.placeholder")}
        showLabel={common("showPassword")}
        hideLabel={common("hidePassword")}
        error={formState.errors.password?.message}
        labelAction={
          <Link
            href={FORGOT_PASSWORD_PATH}
            className="text-brand-700 hover:text-brand-800 text-[14px] font-medium"
          >
            {t("password.forgot")}
          </Link>
        }
        {...register("password")}
      />

      <Checkbox id="rememberMe" label={t("rememberMe")} {...register("rememberMe")} />

      {failure !== undefined ? (
        <p
          role="alert"
          className="rounded-field bg-danger-100 text-danger-700 px-4 py-3 text-center text-[15px] font-semibold"
        >
          {t(`errors.${failure}`)}
        </p>
      ) : null}

      {formState.isSubmitting || signedIn ? (
        <LoadingDots label={t("submitting")} />
      ) : (
        <Button variant="primary" type="submit">
          {t("submit")}
          <Icon name="arrow-right" className="size-4.5" />
        </Button>
      )}

      <p className="text-ink-label text-center text-[15px] font-semibold">{t("contactAdmin")}</p>

      <LanguageSwitcher label={common("language")} />
    </form>
  );
}
