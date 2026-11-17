import type { ComponentProps } from "react";
import { useTranslations } from "use-intl";
import { Select } from "@/components/ui/Select";
import type { Project } from "@/lib/projects";

type ProjectSelectProps = Omit<
  ComponentProps<typeof Select>,
  "label" | "options" | "placeholder" | "required"
> & {
  projects: readonly Project[];
};

export function ProjectSelect({ projects, ...props }: ProjectSelectProps) {
  const common = useTranslations("common");

  return (
    <Select
      label={common("project")}
      required
      placeholder={common("projectPlaceholder")}
      options={projects.map((project) => ({ value: project.id, label: project.name }))}
      {...props}
    />
  );
}

export function onlyProjectId(projects: readonly Project[]): string {
  return projects.length === 1 ? (projects[0]?.id ?? "") : "";
}
