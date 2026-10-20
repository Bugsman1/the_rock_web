import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useTranslations } from "use-intl";
import { PageTitle, BackLink } from "@/components/ui/PageHeader";
import { getCustomerChoices } from "@/lib/customersApi";
import { nowAsTimeValue, todayAsInputValue } from "@/lib/datetime";
import { isInService } from "@/lib/projects";
import { getProjects } from "@/lib/projectsApi";
import { SHIPMENTS_HREF, shipmentsProjectHref } from "@/lib/routes";
import { NewShipmentForm } from "./ShipmentForm";

export async function newShipmentLoader({ request }: LoaderFunctionArgs) {
  const requested = new URL(request.url).searchParams.get("project");
  const [customers, projects] = await Promise.all([getCustomerChoices(), getProjects()]);
  const inService = projects.filter(isInService);

  return {
    customers,
    projects: inService,
    project: inService.find((project) => project.id === requested)?.id,
  };
}

export function NewShipmentScreen() {
  const { customers, projects, project } = useLoaderData<typeof newShipmentLoader>();
  const t = useTranslations("shipments.form");
  const common = useTranslations("common");
  const backHref = project === undefined ? SHIPMENTS_HREF : shipmentsProjectHref(project);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div className="flex flex-col gap-3">
        <BackLink href={backHref} label={common("back")} />

        <PageTitle>{t("title")}</PageTitle>
      </div>

      <NewShipmentForm
        defaultArrivalDate={todayAsInputValue()}
        defaultArrivalTime={nowAsTimeValue()}
        customers={customers}
        projects={projects}
        defaultProject={project}
        backHref={backHref}
      />
    </div>
  );
}
