import { useLocale, useTranslations } from "use-intl";
import { ActionLink } from "@/components/ui/ActionLink";
import { DataTable } from "@/components/ui/DataTable";
import type { DataColumn } from "@/components/ui/DataTable";
import { useCan } from "@/lib/accessContext";
import { formatCount, formatDateTime, formatQuantity } from "@/lib/format";
import type { MillingOperation } from "@/lib/grinding";
import { parseGrinderCode } from "@/lib/projects";
import type { RefiningOperation } from "@/lib/refining";
import { startRefiningHref } from "@/lib/routes";
import { matchesSearch } from "@/lib/search";
import { isLossReasonKey } from "./refining";

export function RefiningQueueTable({
  queue,
  query,
}: {
  queue: readonly MillingOperation[];
  query: string;
}) {
  const t = useTranslations("refining");
  const common = useTranslations("common");
  const locale = useLocale();
  const canStart = useCan()("refining", "add");
  const machineName = (machine: number) =>
    t("machineNumber", { number: formatCount(machine, locale) });
  const operations = queue.filter((operation) =>
    matchesSearch(
      {
        texts: [operation.shipmentNumber, operation.client, machineName(operation.machine)],
        phone: "",
      },
      query,
    ),
  );

  const columns: DataColumn<MillingOperation>[] = [
    {
      key: "shipment",
      header: t("fields.shipment"),
      className: "text-ink font-bold",
      cell: (operation) => operation.shipmentNumber,
    },
    {
      key: "client",
      header: t("fields.client"),
      className: "text-ink font-bold",
      cell: (operation) => <span dir="auto">{operation.client}</span>,
    },
    {
      key: "machine",
      header: t("fields.machine"),
      className: "text-ink font-semibold",
      cell: (operation) => machineName(operation.machine),
    },
    {
      key: "bags",
      header: t("fields.bags"),
      align: "end",
      className: "text-ink font-bold",
      cell: (operation) => formatCount(operation.bags, locale),
    },
    {
      key: "groundAt",
      header: t("fields.groundAt"),
      className: "text-ink-muted font-semibold",
      cell: (operation) =>
        operation.endedAt === undefined ? "—" : formatDateTime(operation.endedAt, locale),
    },
  ];

  if (canStart) {
    columns.push({
      key: "action",
      header: t("fields.action"),
      hideHeader: true,
      align: "end",
      cell: (operation) => (
        <ActionLink
          href={startRefiningHref(operation.project, operation.id)}
          icon="flame"
          ariaLabel={t("startLabel", { number: operation.shipmentNumber })}
        >
          {t("start")}
        </ActionLink>
      ),
    });
  }

  return (
    <DataTable
      columns={columns}
      rows={operations}
      rowKey={(operation) => operation.id}
      empty={queue.length === 0 ? t("queueEmpty") : common("noMatch")}
    />
  );
}

function TruncatedText({ value }: { value: string }) {
  return value === "" ? (
    "—"
  ) : (
    <span dir="auto" title={value} className="block truncate">
      {value}
    </span>
  );
}

export function RefiningOperationsTable({
  refinings,
  query,
  editHrefOf,
}: {
  refinings: readonly RefiningOperation[];
  query: string;
  editHrefOf: (refining: RefiningOperation) => string | undefined;
}) {
  const t = useTranslations("refining");
  const common = useTranslations("common");
  const locale = useLocale();
  const quantity = (value: number) => formatQuantity(value, locale);
  const optionalQuantity = (value: number) => (value > 0 ? quantity(value) : "—");
  const machineName = (code: string) => {
    const machine = parseGrinderCode(code);

    return machine === undefined
      ? code
      : t("machineNumber", { number: formatCount(machine.number, locale) });
  };
  const operations = refinings.filter((operation) =>
    matchesSearch(
      {
        texts: [
          operation.shipmentNumber,
          operation.client,
          machineName(operation.grinderCode),
          operation.workerName,
        ],
        phone: "",
      },
      query,
    ),
  );

  const weight = (
    key: string,
    header: string,
    value: (operation: RefiningOperation) => string,
  ) => ({
    key,
    header,
    align: "end" as const,
    className: "text-ink font-bold",
    cell: value,
  });
  const columns: DataColumn<RefiningOperation>[] = [
    {
      key: "refinedAt",
      header: t("fields.refinedAt"),
      className: "text-ink-muted font-semibold",
      cell: (operation) => formatDateTime(operation.refinedAt, locale),
    },
    {
      key: "shipment",
      header: t("fields.shipment"),
      rowLink: true,
      className: "text-ink font-bold",
      cell: (operation) => operation.shipmentNumber,
    },
    {
      key: "client",
      header: t("fields.client"),
      className: "text-ink font-bold",
      cell: (operation) => <span dir="auto">{operation.client}</span>,
    },
    {
      key: "machine",
      header: t("fields.machine"),
      className: "text-ink font-semibold",
      cell: (operation) => machineName(operation.grinderCode),
    },
    {
      key: "worker",
      header: t("fields.worker"),
      className: "text-ink font-semibold",
      cell: (operation) => <span dir="auto">{operation.workerName}</span>,
    },
    weight("bags", t("fields.bags"), (operation) => formatCount(operation.bags, locale)),
    weight("weightBefore", t("fields.weightBefore"), (operation) =>
      quantity(operation.weightBefore),
    ),
    weight("weightAfter", t("fields.weightAfter"), (operation) => quantity(operation.weightAfter)),
    weight("goldWithMaterial", t("fields.goldWithMaterial"), (operation) =>
      quantity(operation.goldWithMaterial),
    ),
    weight("goldWithoutMaterial", t("fields.goldWithoutMaterial"), (operation) =>
      optionalQuantity(operation.goldWithoutMaterial),
    ),
    weight("loss", t("fields.loss"), (operation) => quantity(operation.loss)),
    {
      key: "lossReason",
      header: t("fields.lossReason"),
      className: "text-ink-muted max-w-60 font-semibold",
      cell: (operation) => (
        <TruncatedText
          value={
            isLossReasonKey(operation.lossReason)
              ? t(`lossReasons.${operation.lossReason}`)
              : operation.lossReason
          }
        />
      ),
    },
    {
      key: "notes",
      header: t("fields.notes"),
      className: "text-ink-muted max-w-60 font-semibold",
      cell: (operation) => <TruncatedText value={operation.notes} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={operations}
      rowKey={(operation) => operation.id}
      empty={refinings.length === 0 ? t("operationsEmpty") : common("noMatch")}
      rowLink={(operation) => {
        const href = editHrefOf(operation);

        return href === undefined
          ? undefined
          : { href, label: t("editLabel", { shipment: operation.shipmentNumber }) };
      }}
    />
  );
}
