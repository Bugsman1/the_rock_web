import type { ApiSchema } from "@/lib/api/client";
import { parsePageNumber } from "@/lib/api/pagination";
import { isIsoDate } from "@/lib/datetime";
import type { FilterState } from "@/lib/filters";
import type { IsoTimestamp } from "@/lib/format";
import { displayName } from "@/lib/profile";
import { isRecordId } from "@/lib/projects";

export const auditActions = ["create", "update", "delete"] as const;

export type AuditAction = (typeof auditActions)[number];

export function isAuditAction(value: string): value is AuditAction {
  return auditActions.some((action) => action === value);
}

export type AuditField = {
  field: string;
  label: string;
  before: unknown;
  after: unknown;
};

export type AuditEntry = {
  id: string;
  at: IsoTimestamp;
  action: AuditAction;
  modelName: string;
  objectId: string;
  projectName: string;
  userName: string;
  userEmail: string;
  fields: readonly AuditField[];
};

export type AuditChoice = { value: string; label: string };

export type AuditFilter = {
  search: string;
  action: AuditAction | undefined;
  model: string;
  user: string;
  project: string;
  from: string;
  to: string;
};

export type AuditQuery = AuditFilter & { page: number; entry: string };

export type AuditValue =
  { kind: "empty" } | { kind: "yes" } | { kind: "no" } | { kind: "text"; text: string };

const MODEL_NAME = /^[A-Za-z][A-Za-z0-9]*$/;

function textOrEmpty(value: string | null | undefined): string {
  return value ?? "";
}

function isPlainObject(value: unknown): value is object {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function snapshotFields(snapshot: unknown, side: "before" | "after"): AuditField[] {
  if (!isPlainObject(snapshot)) {
    return [];
  }

  return Object.entries(snapshot).map(([field, value]: [string, unknown]) => ({
    field,
    label: field,
    before: side === "before" ? value : undefined,
    after: side === "after" ? value : undefined,
  }));
}

function changedField(change: Readonly<Record<string, unknown>>): AuditField[] {
  const { field, label } = change;

  if (typeof field !== "string") {
    return [];
  }

  return [
    {
      field,
      label: typeof label === "string" && label !== "" ? label : field,
      before: change.old,
      after: change.new,
    },
  ];
}

function fieldsOf(entry: ApiSchema<"AuditLog">): readonly AuditField[] {
  if (entry.action === "create") return snapshotFields(entry.new_values, "after");
  if (entry.action === "delete") return snapshotFields(entry.old_values, "before");

  return entry.changes.flatMap(changedField);
}

export function auditEntryFromApi(entry: ApiSchema<"AuditLog">): AuditEntry {
  const userEmail = textOrEmpty(entry.user_email);

  return {
    id: String(entry.id),
    at: entry.timestamp,
    action: entry.action,
    modelName: entry.model_name,
    objectId: entry.object_id,
    projectName: textOrEmpty(entry.project_name),
    userName: displayName({ full_name: textOrEmpty(entry.user_name), email: userEmail }),
    userEmail,
    fields: fieldsOf(entry),
  };
}

export function auditedModelFromApi(model: ApiSchema<"AuditedModel">): AuditChoice {
  return { value: model.model, label: model.model_name };
}

export function auditUserFromApi(user: ApiSchema<"User">): AuditChoice {
  return {
    value: String(user.id),
    label: displayName({ full_name: textOrEmpty(user.full_name), email: user.email }),
  };
}

export function auditValueOf(value: unknown): AuditValue {
  if (value === null || value === undefined || value === "") return { kind: "empty" };
  if (typeof value === "boolean") return { kind: value ? "yes" : "no" };
  if (typeof value === "string") return { kind: "text", text: value };
  if (typeof value === "number") return { kind: "text", text: String(value) };

  return { kind: "text", text: JSON.stringify(value) };
}

function recordIdOr(value: string | null): string {
  return value !== null && isRecordId(value) ? value : "";
}

function dateOr(value: string | null): string {
  return value !== null && isIsoDate(value) ? value : "";
}

export function auditQueryFromParams(params: URLSearchParams): AuditQuery {
  const action = params.get("action") ?? "";
  const model = params.get("model") ?? "";

  return {
    search: (params.get("q") ?? "").trim(),
    action: isAuditAction(action) ? action : undefined,
    model: MODEL_NAME.test(model) ? model : "",
    user: recordIdOr(params.get("user")),
    project: recordIdOr(params.get("project")),
    from: dateOr(params.get("from")),
    to: dateOr(params.get("to")),
    page: parsePageNumber(params.get("page")),
    entry: recordIdOr(params.get("entry")),
  };
}

export function auditQueryParams(query: AuditFilter & { page?: number; entry?: string }) {
  const params = new URLSearchParams();
  const values: readonly (readonly [string, string | undefined])[] = [
    ["q", query.search],
    ["action", query.action],
    ["model", query.model],
    ["user", query.user],
    ["project", query.project],
    ["from", query.from],
    ["to", query.to],
    ["page", query.page !== undefined && query.page > 1 ? String(query.page) : undefined],
    ["entry", query.entry],
  ];

  for (const [name, value] of values) {
    if (value !== undefined && value !== "") params.set(name, value);
  }

  return params;
}

export function auditFilterState(filter: AuditFilter): FilterState {
  const chosen = (value: string | undefined) =>
    value === undefined || value === "" ? [] : [value];

  return {
    selection: {
      action: chosen(filter.action),
      model: chosen(filter.model),
      user: chosen(filter.user),
      project: chosen(filter.project),
    },
    client: "",
    from: filter.from,
    to: filter.to,
  };
}

export function auditFilterFromState(search: string, state: FilterState): AuditFilter {
  return auditQueryFromParams(
    new URLSearchParams({
      q: search,
      action: state.selection.action?.[0] ?? "",
      model: state.selection.model?.[0] ?? "",
      user: state.selection.user?.[0] ?? "",
      project: state.selection.project?.[0] ?? "",
      from: state.from,
      to: state.to,
    }),
  );
}

export function isAuditFiltered(filter: AuditFilter): boolean {
  return (
    filter.search !== "" ||
    filter.action !== undefined ||
    [filter.model, filter.user, filter.project, filter.from, filter.to].some(
      (value) => value !== "",
    )
  );
}
