import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useTranslations } from "use-intl";
import { PageTitle, BackLink } from "@/components/ui/PageHeader";
import { nowAsTimeValue, todayAsInputValue } from "@/lib/datetime";
import { isInService } from "@/lib/projects";
import { getProjects } from "@/lib/projectsApi";
import { SHIPMENTS_HREF, shipmentsProjectHref } from "@/lib/routes";
import { NewShipmentForm } from "./ShipmentForm";

export async function newShipmentLoader({ request }: LoaderFunctionArgs) {
  const requested = new URL(request.url).searchParams.get("project");
  const inService = (await getProjects()).filter(isInService);

  return {
    projects: inService,
    project: inService.find((project) => project.id === requested)?.id,
  };
}

export function NewShipmentScreen() {
  const { projects, project } = useLoaderData<typeof newShipmentLoader>();
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
        projects={projects}
        defaultProject={project}
        backHref={backHref}
      />
    </div>
  );
}
