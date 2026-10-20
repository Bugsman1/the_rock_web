import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { IntlProvider } from "use-intl";
import { noAccess } from "@/lib/access";
import type { Access } from "@/lib/access";
import { AccessContext } from "@/lib/accessContext";
import type { MillingOperation } from "@/lib/grinding";
import messages from "@/messages/fr.json";

export const allRights: Access = { ...noAccess, superuser: true };

export function inFrench(children: ReactNode, access: Access = allRights) {
  return render(
    <IntlProvider locale="fr" messages={messages} timeZone="Africa/Nouakchott">
      <AccessContext value={access}>{children}</AccessContext>
    </IntlProvider>,
  );
}

export const running: MillingOperation = {
  id: "42",
  project: "3",
  machine: 7,
  shipmentNumber: "SH-1052",
  client: "Mariem",
  bags: 2,
  operatorName: "Ahmed",
  startedAt: "2026-10-08T06:00:00.000Z",
  estimatedEndAt: "2026-10-08T12:00:00.000Z",
  notes: "",
};
