import { useTranslations } from "use-intl";
import type { ResourceKind } from "@/lib/resourceKinds";

export function useResourceName() {
  const kindName = useTranslations("resourceKinds");

  return (resource: { kind: ResourceKind | undefined; name: string }) =>
    resource.kind === undefined ? resource.name : kindName(resource.kind);
}
