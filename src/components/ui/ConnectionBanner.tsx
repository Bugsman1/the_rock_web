import { useSyncExternalStore } from "react";
import { useTranslations } from "use-intl";
import { isConnectionLost, subscribeToConnection } from "@/lib/api/connection";
import { Icon } from "./Icon";

export function ConnectionBanner() {
  const common = useTranslations("common");
  const lost = useSyncExternalStore(subscribeToConnection, isConnectionLost);

  if (!lost) {
    return null;
  }

  return (
    <div
      role="alert"
      className="bg-danger-700 text-ink-inverted flex shrink-0 items-center justify-center gap-2 px-4 py-2.5 text-center text-sm font-bold"
    >
      <Icon name="wifi-off" className="size-5 shrink-0" />
      {common("connectionLost")}
    </div>
  );
}
