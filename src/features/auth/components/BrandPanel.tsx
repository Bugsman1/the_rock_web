import { useTranslations } from "use-intl";
import logoUrl from "@/icons/logo_soukhour.svg";

const CURRENT_YEAR = new Date().getFullYear();

function PanelDecoration() {
  return (
    <div aria-hidden>
      <span className="absolute -end-35 -bottom-40 size-105 rounded-full border border-white/12" />
      <span className="absolute -end-15 -bottom-20 size-65 rounded-full border border-white/12" />
      <span className="absolute end-16 top-30 size-45 rotate-18 rounded-[36px] bg-white/6" />
    </div>
  );
}

export function BrandPanel() {
  const common = useTranslations("common");
  const t = useTranslations("auth.login");

  return (
    <section className="bg-brand-700 text-ink-inverted rounded-e-panel relative flex min-w-0 shrink grow basis-105 flex-col justify-between gap-12 overflow-hidden p-14">
      <PanelDecoration />

      <div className="relative flex items-center gap-3">
        <span className="rounded-field bg-surface inline-flex size-16 items-center justify-center">
          <img src={logoUrl} alt="" className="size-13" />
        </span>
        <span className="text-[20px] font-bold">{common("appName")}</span>
      </div>

      <div className="relative flex max-w-105 flex-col gap-4">
        <h2 className="text-[38px] leading-[1.35] font-bold">{t("welcomeTitle")}</h2>
        <p className="text-[17px] leading-[1.9] text-white/82">{t("welcomeBody")}</p>
      </div>

      <p className="relative text-[14px] text-white/70">
        {t("copyright", { year: CURRENT_YEAR, company: common("companyName") })}
      </p>
    </section>
  );
}
