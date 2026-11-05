import { useId, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useLocale, useTranslations } from "use-intl";
import { Button } from "./Button";
import { ButtonLink } from "./ButtonLink";
import { Checkbox } from "./Checkbox";
import { Combobox } from "./Combobox";
import { DateField } from "./DateField";
import { Icon } from "./Icon";
import { PageLayout } from "./PageHeader";
import { SlotPage } from "./PageSlot";
import { Select } from "./Select";
import { usePathname, useReplace, useSearch } from "@/i18n/navigation";
import {
  activeFilterCount,
  FILTER_PAGE_PARAM,
  matchesFilters,
  noFilters,
  toggleFilter,
} from "@/lib/filters";
import type { FilterFields, FilterState } from "@/lib/filters";
import { formatCount } from "@/lib/format";

export type FilterMenuGroup = {
  key: string;
  label: string;
  single?: boolean;
  allLabel?: string;
  options: readonly { value: string; label: string }[];
};

type ClientChoice = { value: string; label: string; hint?: string };

export type ClientFilter = {
  options: readonly ClientChoice[];
  chosenLabel?: string;
  onSearch?: (text: string) => void;
};

type DraftChange = Dispatch<SetStateAction<FilterState>>;

export type FilterData = {
  state: FilterState;
  onApply: (state: FilterState) => void;
};

type FilterMenuProps = FilterData & {
  groups: readonly FilterMenuGroup[];
  clients?: ClientFilter;
  dateLabel?: string;
  oneLine?: boolean;
};

export function useFilters<Row>(fields: FilterFields<Row>): {
  menu: FilterData;
  matches: (row: Row) => boolean;
} {
  const [state, setState] = useState<FilterState>(noFilters);

  return {
    menu: { state, onApply: setState },
    matches: (row: Row) => matchesFilters(row, fields, state),
  };
}

function ClientPicker({
  clients,
  draft,
  onChange,
}: {
  clients: ClientFilter;
  draft: FilterState;
  onChange: DraftChange;
}) {
  const t = useTranslations("filters");
  const id = useId();
  const [text, setText] = useState(() =>
    draft.client === ""
      ? ""
      : (clients.options.find((client) => client.value === draft.client)?.label ??
        clients.chosenLabel ??
        ""),
  );
  const choose = (client: string) => onChange((current) => ({ ...current, client }));

  return (
    <Combobox
      id={id}
      label={t("client")}
      placeholder={t("allClients")}
      value={text}
      options={clients.options}
      onChange={(typed) => {
        setText(typed);
        choose("");
        clients.onSearch?.(typed);
      }}
      onSelect={(client) => choose(client.value)}
    />
  );
}

function DateRange({
  label,
  draft,
  onChange,
}: {
  label: string;
  draft: FilterState;
  onChange: DraftChange;
}) {
  const t = useTranslations("filters");
  const common = useTranslations("common");
  const id = useId();
  const field = (bound: "from" | "to") => (
    <DateField
      id={`${id}-${bound}`}
      label={t(bound)}
      pickerLabel={common("openCalendar")}
      placeholder={common("datePlaceholder")}
      value={draft[bound]}
      onChange={(value) => onChange((current) => ({ ...current, [bound]: value }))}
    />
  );

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-ink mb-2 text-base font-bold">{label}</legend>
      <div className="grid grid-cols-2 gap-3">
        {field("from")}
        {field("to")}
      </div>
    </fieldset>
  );
}

function ChoiceGroup({
  group,
  draft,
  onChange,
}: {
  group: FilterMenuGroup;
  draft: FilterState;
  onChange: DraftChange;
}) {
  const id = useId();
  const chosen = draft.selection[group.key] ?? [];

  if (group.allLabel !== undefined) {
    return (
      <Select
        id={id}
        label={group.label}
        value={chosen[0] ?? ""}
        options={[{ value: "", label: group.allLabel }, ...group.options]}
        onChange={(event) => {
          const value = event.target.value;

          onChange((current) => ({
            ...current,
            selection: { ...current.selection, [group.key]: value === "" ? [] : [value] },
          }));
        }}
      />
    );
  }

  return (
    <fieldset className="flex flex-col">
      <legend className="text-ink mb-1 text-base font-bold">{group.label}</legend>
      {group.options.map((option) => (
        <Checkbox
          key={option.value}
          id={`${id}-${option.value}`}
          label={option.label}
          checked={chosen.includes(option.value)}
          onChange={() =>
            onChange((current) =>
              toggleFilter(current, group.key, option.value, group.single === true),
            )
          }
        />
      ))}
    </fieldset>
  );
}

function FilterForm({ groups, clients, dateLabel, oneLine, state, onApply }: FilterMenuProps) {
  const t = useTranslations("filters");
  const [draft, setDraft] = useState(state);
  const [resets, setResets] = useState(0);

  function clear() {
    setDraft(noFilters);
    setResets((count) => count + 1);
  }

  return (
    <section className="rounded-card border-line bg-surface shadow-subtle flex flex-col gap-6 border-[1.5px] p-6">
      <div
        key={resets}
        className={
          oneLine === true
            ? "flex flex-wrap items-start gap-6 *:min-w-60 *:flex-1"
            : "grid gap-6 md:grid-cols-2"
        }
      >
        {clients === undefined ? null : (
          <ClientPicker clients={clients} draft={draft} onChange={setDraft} />
        )}
        {dateLabel === undefined ? null : (
          <DateRange label={dateLabel} draft={draft} onChange={setDraft} />
        )}
        {groups.map((group) => (
          <ChoiceGroup key={group.key} group={group} draft={draft} onChange={setDraft} />
        ))}
      </div>

      <div className="border-line flex flex-wrap items-center gap-3 border-t-[1.5px] pt-5">
        <Button variant="primary" width="auto" onClick={() => onApply(draft)}>
          <Icon name="filter" />
          {t("show")}
        </Button>
        {activeFilterCount(draft) > 0 ? (
          <Button variant="secondary" width="auto" onClick={clear}>
            <Icon name="x" />
            {t("clear")}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function hrefWith(pathname: string, search: URLSearchParams, open: boolean): string {
  const params = new URLSearchParams(search);

  if (open) {
    params.set(FILTER_PAGE_PARAM, "1");
  } else {
    params.delete(FILTER_PAGE_PARAM);
  }

  const query = params.toString();

  return query === "" ? pathname : `${pathname}?${query}`;
}

export function FilterMenu(props: FilterMenuProps) {
  const t = useTranslations("filters");
  const common = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const search = useSearch();
  const replace = useReplace();
  const active = activeFilterCount(props.state);
  const closeHref = hrefWith(pathname, search, false);

  return (
    <>
      <ButtonLink href={hrefWith(pathname, search, true)} variant="secondary">
        <Icon name="filter" />
        {t("button")}
        {active > 0 ? (
          <span className="bg-brand-700 text-ink-inverted rounded-full px-2 text-xs font-bold">
            {formatCount(active, locale)}
          </span>
        ) : null}
      </ButtonLink>

      {search.get(FILTER_PAGE_PARAM) === "1" ? (
        <SlotPage>
          <PageLayout backHref={closeHref} backLabel={common("back")} title={t("button")}>
            <FilterForm
              {...props}
              onApply={(state) => {
                replace(closeHref);
                props.onApply(state);
              }}
            />
          </PageLayout>
        </SlotPage>
      ) : null}
    </>
  );
}
