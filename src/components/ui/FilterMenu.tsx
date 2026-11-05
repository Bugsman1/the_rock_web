import { createContext, use, useEffect, useId, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "use-intl";
import { Button } from "./Button";
import { Combobox } from "./Combobox";
import { DateField } from "./DateField";
import { Icon } from "./Icon";
import { LoadingDots } from "./LoadingDots";
import { MultiSelect } from "./MultiSelect";
import { Select } from "./Select";
import { activeFilterCount, matchesFilters, noFilters, toggleFilter } from "@/lib/filters";
import type { FilterFields, FilterState } from "@/lib/filters";
import { formatCount } from "@/lib/format";

export type FilterMenuGroup = {
  key: string;
  label: string;
  single?: boolean;
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
  onApply: (state: FilterState) => void | Promise<void>;
};

type FilterMenuProps = FilterData & {
  groups: readonly FilterMenuGroup[];
  clients?: ClientFilter;
  dateLabel?: string;
};

type Slot = { target: HTMLElement | null; setTarget: (target: HTMLElement | null) => void };

const FilterSlotContext = createContext<Slot | null>(null);

export function FilterSlot({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  return <FilterSlotContext value={{ target, setTarget }}>{children}</FilterSlotContext>;
}

export function FilterSlotTarget() {
  const slot = use(FilterSlotContext);

  return <div ref={slot?.setTarget} className="contents" />;
}

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
  const [firstText] = useState(text);
  const { onSearch } = clients;
  const choose = (client: string) => onChange((current) => ({ ...current, client }));

  useEffect(() => {
    onSearch?.(firstText);
  }, [onSearch, firstText]);

  return (
    <div className="w-full sm:w-64">
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
    </div>
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
    <fieldset className="flex w-full flex-col gap-1.5 sm:w-80">
      <legend className="sr-only">{label}</legend>
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
  const t = useTranslations("filters");
  const id = useId();
  const chosen = draft.selection[group.key] ?? [];

  return (
    <div className="w-full sm:w-56">
      {group.single === true ? (
        <Select
          id={id}
          label={group.label}
          value={chosen[0] ?? ""}
          options={[{ value: "", label: t("all") }, ...group.options]}
          onChange={(event) => {
            const value = event.target.value;

            onChange((current) => ({
              ...current,
              selection: { ...current.selection, [group.key]: value === "" ? [] : [value] },
            }));
          }}
        />
      ) : (
        <MultiSelect
          id={id}
          label={group.label}
          allLabel={t("all")}
          options={group.options}
          chosen={chosen}
          onToggle={(value) => onChange((current) => toggleFilter(current, group.key, value))}
        />
      )}
    </div>
  );
}

function FilterCard({
  groups,
  clients,
  dateLabel,
  state,
  onApply,
  onClose,
}: FilterMenuProps & { onClose: () => void }) {
  const t = useTranslations("filters");
  const common = useTranslations("common");
  const [draft, setDraft] = useState(state);
  const [resets, setResets] = useState(0);
  const [loading, setLoading] = useState(false);

  async function apply(next: FilterState) {
    setLoading(true);

    try {
      await onApply(next);
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setDraft(noFilters);
    setResets((count) => count + 1);
    void apply(noFilters);
  }

  return (
    <section
      aria-label={t("button")}
      aria-busy={loading}
      className="rounded-card border-line bg-surface shadow-subtle flex flex-col gap-4 border-[1.5px] p-4"
    >
      <div key={resets} className="flex flex-wrap items-start gap-4">
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

      <div className="flex flex-wrap items-center gap-3">
        {loading ? (
          <div className="w-50">
            <LoadingDots label={common("loading")} />
          </div>
        ) : (
          <Button variant="primary" width="auto" onClick={() => void apply(draft)}>
            <Icon name="filter" />
            {t("show")}
          </Button>
        )}
        {activeFilterCount(draft) > 0 || activeFilterCount(state) > 0 ? (
          <Button variant="secondary" width="auto" disabled={loading} onClick={clear}>
            <Icon name="x" />
            {t("clear")}
          </Button>
        ) : null}
        <Button variant="secondary" width="auto" onClick={onClose}>
          {common("close")}
        </Button>
      </div>
    </section>
  );
}

export function FilterMenu(props: FilterMenuProps) {
  const t = useTranslations("filters");
  const locale = useLocale();
  const slot = use(FilterSlotContext);
  const [open, setOpen] = useState(false);
  const active = activeFilterCount(props.state);
  const card = open ? <FilterCard {...props} onClose={() => setOpen(false)} /> : null;

  return (
    <>
      <Button
        variant="secondary"
        width="auto"
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
      >
        <Icon name="filter" />
        {t("button")}
        {active > 0 ? (
          <span className="bg-brand-700 text-ink-inverted rounded-full px-2 text-xs font-bold">
            {formatCount(active, locale)}
          </span>
        ) : null}
      </Button>

      {slot === null || slot.target === null ? card : createPortal(card, slot.target)}
    </>
  );
}
