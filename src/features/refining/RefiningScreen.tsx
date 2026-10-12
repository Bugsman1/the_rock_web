import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { ActionLink } from "@/components/ui/ActionLink";
import { Drawer, useRouteDrawer } from "@/components/ui/Drawer";
import {
  PanelError,
  TablePanel,
  tableCellClasses,
  tableEndHeadClasses,
  tableHeadClasses,
  tableRowClasses,
} from "@/components/ui/TablePanel";
import { errorKind } from "@/lib/api/client";
import { nowAsTimeValue, todayAsInputValue } from "@/lib/datetime";
import { formatCount, formatDateTime, formatQuantity } from "@/lib/format";
import type { MillingOperation } from "@/lib/grinding";
import { findProject, grinderCode } from "@/lib/projects";
import type { RefiningOperation } from "@/lib/refining";
import { REFINING_HREF, startRefiningHref } from "@/lib/routes";
import { getActiveUsers, operatorsOfProject } from "@/lib/users";
import { isLossReasonKey, refiningQueue } from "./refining";
import { getRefiningData } from "./refiningApi";
import { RefiningForm } from "./RefiningForm";

export async function refiningLoader({ request }: LoaderFunctionArgs) {
  const grinding = new URL(request.url).searchParams.get("grinding");
  const data = await getRefiningData();
  const refinings = data.operations.ok ? data.operations.data : [];
  const queue = refiningQueue(data.grindings, refinings);
  const selected = queue.find((operation) => operation.id === grinding);
  const workers =
    selected === undefined ? [] : operatorsOfProject(await getActiveUsers(), selected.project);

  return { data, queue, refinings, selected, workers };
}

function RefiningQueueTable({
  operations,
  projectName,
}: {
  operations: readonly MillingOperation[];
  projectName: (project: string) => string;
}) {
  const t = useTranslations("refining");
  const locale = useLocale();

  if (operations.length === 0) {
    return <p className="text-ink-muted p-6 text-[15px] font-semibold">{t("queueEmpty")}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="bg-surface-page">
          <tr className="border-line border-b-[1.5px]">
            <th className={tableHeadClasses}>{t("fields.shipment")}</th>
            <th className={tableHeadClasses}>{t("fields.client")}</th>
            <th className={tableHeadClasses}>{t("fields.project")}</th>
            <th className={tableHeadClasses}>{t("fields.machine")}</th>
            <th className={tableEndHeadClasses}>{t("fields.bags")}</th>
            <th className={tableHeadClasses}>{t("fields.groundAt")}</th>
            <th className={tableHeadClasses}>
              <span className="sr-only">{t("fields.action")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {operations.map((operation) => (
            <tr key={operation.id} className={tableRowClasses}>
              <td className={`${tableCellClasses} text-ink font-bold`}>
                {operation.shipmentNumber}
              </td>
              <td className={`${tableCellClasses} text-ink font-bold`}>
                <span dir="auto">{operation.client}</span>
              </td>
              <td className={`${tableCellClasses} text-ink-muted font-semibold`}>
                <span dir="auto">{projectName(operation.project)}</span>
              </td>
              <td className={`${tableCellClasses} text-ink font-semibold`}>
                <span dir="ltr">{grinderCode(operation.project, operation.machine)}</span>
              </td>
              <td className={`${tableCellClasses} text-ink text-end font-bold`}>
                {formatCount(operation.bagsMilled ?? operation.bags, locale)}
              </td>
              <td className={`${tableCellClasses} text-ink-muted font-semibold`}>
                {operation.endedAt === undefined ? "—" : formatDateTime(operation.endedAt, locale)}
              </td>
              <td className={`${tableCellClasses} text-end`}>
                <ActionLink
                  href={startRefiningHref(operation.id)}
                  icon="flame"
                  ariaLabel={t("startLabel", { number: operation.shipmentNumber })}
                >
                  {t("start")}
                </ActionLink>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TextCell({ value }: { value: string }) {
  return (
    <td className={`${tableCellClasses} text-ink-muted max-w-60 font-semibold`}>
      {value === "" ? (
        "—"
      ) : (
        <span dir="auto" title={value} className="block truncate">
          {value}
        </span>
      )}
    </td>
  );
}

function RefiningOperationsTable({ operations }: { operations: readonly RefiningOperation[] }) {
  const t = useTranslations("refining");
  const locale = useLocale();
  const quantity = (value: number) => formatQuantity(value, locale);
  const number = `${tableCellClasses} text-ink text-end font-bold`;

  if (operations.length === 0) {
    return <p className="text-ink-muted p-6 text-[15px] font-semibold">{t("operationsEmpty")}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="bg-surface-page">
          <tr className="border-line border-b-[1.5px]">
            <th className={tableHeadClasses}>{t("fields.refinedAt")}</th>
            <th className={tableHeadClasses}>{t("fields.shipment")}</th>
            <th className={tableHeadClasses}>{t("fields.client")}</th>
            <th className={tableHeadClasses}>{t("fields.project")}</th>
            <th className={tableHeadClasses}>{t("fields.machine")}</th>
            <th className={tableHeadClasses}>{t("fields.worker")}</th>
            <th className={tableEndHeadClasses}>{t("fields.bags")}</th>
            <th className={tableEndHeadClasses}>{t("fields.weightBefore")}</th>
            <th className={tableEndHeadClasses}>{t("fields.weightAfter")}</th>
            <th className={tableEndHeadClasses}>{t("fields.weightLoss")}</th>
            <th className={tableEndHeadClasses}>{t("fields.gold")}</th>
            <th className={tableEndHeadClasses}>{t("fields.goldWithMaterial")}</th>
            <th className={tableEndHeadClasses}>{t("fields.goldWithoutMaterial")}</th>
            <th className={tableEndHeadClasses}>{t("fields.loss")}</th>
            <th className={tableHeadClasses}>{t("fields.lossReason")}</th>
            <th className={tableHeadClasses}>{t("fields.notes")}</th>
          </tr>
        </thead>
        <tbody>
          {operations.map((operation) => (
            <tr key={operation.id} className={tableRowClasses}>
              <td className={`${tableCellClasses} text-ink-muted font-semibold`}>
                {formatDateTime(operation.refinedAt, locale)}
              </td>
              <td className={`${tableCellClasses} text-ink font-bold`}>
                {operation.shipmentNumber}
              </td>
              <td className={`${tableCellClasses} text-ink font-bold`}>
                <span dir="auto">{operation.client}</span>
              </td>
              <td className={`${tableCellClasses} text-ink-muted font-semibold`}>
                <span dir="auto">{operation.projectName}</span>
              </td>
              <td className={`${tableCellClasses} text-ink font-semibold`}>
                <span dir="ltr">{operation.grinderCode}</span>
              </td>
              <td className={`${tableCellClasses} text-ink font-semibold`}>
                <span dir="auto">{operation.workerName}</span>
              </td>
              <td className={number}>{formatCount(operation.bags, locale)}</td>
              <td className={number}>{quantity(operation.weightBefore)}</td>
              <td className={number}>{quantity(operation.weightAfter)}</td>
              <td className={number}>{quantity(operation.weightLoss)}</td>
              <td className={`${tableCellClasses} text-brand-700 text-end font-bold`}>
                {quantity(operation.gold)}
              </td>
              <td className={number}>{quantity(operation.goldWithMaterial)}</td>
              <td className={number}>{quantity(operation.goldWithoutMaterial)}</td>
              <td className={number}>{quantity(operation.loss)}</td>
              <TextCell
                value={
                  isLossReasonKey(operation.lossReason)
                    ? t(`lossReasons.${operation.lossReason}`)
                    : operation.lossReason
                }
              />
              <TextCell value={operation.notes} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RefiningScreen() {
  const { data, queue, refinings, selected, workers } = useLoaderData<typeof refiningLoader>();
  const t = useTranslations("refining");
  const errors = useTranslations("errors");
  const common = useTranslations("common");
  const { close } = useRouteDrawer(REFINING_HREF);
  const projectName = (project: string) => findProject(data.projects, project)?.name ?? "—";
  const now = new Date();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-ink text-[24px] font-bold">{t("title")}</h1>

      <TablePanel title={t("queueTitle")}>
        <RefiningQueueTable operations={queue} projectName={projectName} />
      </TablePanel>

      <TablePanel title={t("operationsTitle")}>
        {data.operations.ok ? (
          <RefiningOperationsTable operations={refinings} />
        ) : (
          <PanelError
            message={errors(`${errorKind(data.operations.status)}.description`)}
            code={errors("status", { status: String(data.operations.status) })}
          />
        )}
      </TablePanel>

      <Drawer
        open={selected !== undefined}
        title={t("new")}
        closeLabel={common("close")}
        onClose={close}
      >
        {selected === undefined ? null : (
          <RefiningForm
            key={selected.id}
            operation={selected}
            projectName={projectName(selected.project)}
            workers={workers}
            defaultDate={todayAsInputValue(now)}
            defaultTime={nowAsTimeValue(now)}
            onCancel={close}
            onSaved={close}
          />
        )}
      </Drawer>
    </div>
  );
}
