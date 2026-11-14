import { describe, expect, it } from "vitest";
import { noFilters } from "@/lib/filters";
import {
  auditedModelFromApi,
  auditEntryFromApi,
  auditFilterFromState,
  auditFilterState,
  auditQueryFromParams,
  auditQueryParams,
  auditUserFromApi,
  auditValueOf,
  isAuditAction,
  isAuditFiltered,
} from "./audit";
import type { AuditFilter } from "./audit";
import { apiCreate, apiDelete, apiUpdate } from "./auditTesting";

const noFilter: AuditFilter = {
  search: "",
  action: undefined,
  model: "",
  user: "",
  project: "",
  from: "",
  to: "",
};

describe("isAuditAction", () => {
  it("knows the backend's three actions only", () => {
    expect(["create", "update", "delete"].every(isAuditAction)).toBe(true);
    expect(isAuditAction("approve")).toBe(false);
  });
});

describe("auditEntryFromApi", () => {
  it("lists the fields an update changed with the backend's labels", () => {
    expect(auditEntryFromApi(apiUpdate)).toEqual({
      id: "12",
      at: "2026-11-13T09:30:00Z",
      action: "update",
      modelName: "Ressource",
      objectId: "2",
      projectName: "Zouérat 1",
      userName: "Aicha",
      userEmail: "aicha@mills.mr",
      fields: [
        { field: "current_quantity", label: "Quantité actuelle", before: "8.500", after: "7.000" },
        { field: "notes", label: "notes", before: "", after: "Vérifié" },
      ],
    });
  });

  it("skips a change the backend sent without a field name", () => {
    const entry = auditEntryFromApi({ ...apiUpdate, changes: [{ label: "?", old: 1, new: 2 }] });

    expect(entry.fields).toEqual([]);
  });

  it("shows the whole record that was created or deleted", () => {
    expect(auditEntryFromApi(apiCreate).fields).toEqual([
      { field: "name", label: "name", before: undefined, after: "Sidi Fournitures" },
      { field: "phone", label: "phone", before: undefined, after: null },
    ]);
    expect(auditEntryFromApi(apiDelete).fields).toEqual([
      { field: "amount", label: "amount", before: "1000.00", after: undefined },
    ]);
  });

  it("falls back to the user's email when the user has no name", () => {
    expect(auditEntryFromApi({ ...apiUpdate, user_name: "" }).userName).toBe("aicha@mills.mr");
  });
});

describe("choices", () => {
  it("turns models and users into filter choices", () => {
    expect(auditedModelFromApi({ model: "Supplier", model_name: "Fournisseur" })).toEqual({
      value: "Supplier",
      label: "Fournisseur",
    });
    expect(
      auditUserFromApi({ id: 3, email: "sidi@mills.mr", full_name: "", phone: "", role: null }),
    ).toEqual({ value: "3", label: "sidi@mills.mr" });
  });
});

describe("auditValueOf", () => {
  it("shows empty values, yes / no and text", () => {
    expect([null, undefined, ""].map(auditValueOf)).toEqual([
      { kind: "empty" },
      { kind: "empty" },
      { kind: "empty" },
    ]);
    expect([true, false].map(auditValueOf)).toEqual([{ kind: "yes" }, { kind: "no" }]);
    expect(auditValueOf("7.000")).toEqual({ kind: "text", text: "7.000" });
    expect(auditValueOf(3)).toEqual({ kind: "text", text: "3" });
    expect(auditValueOf({ a: 1 })).toEqual({ kind: "text", text: '{"a":1}' });
  });
});

describe("audit query in the address", () => {
  it("reads every filter, the page and the open entry", () => {
    const params = new URLSearchParams(
      "q=%20sidi%20&action=update&model=Supplier&user=3&project=4&from=2026-11-01&to=2026-11-13&page=2&entry=12",
    );

    expect(auditQueryFromParams(params)).toEqual({
      search: "sidi",
      action: "update",
      model: "Supplier",
      user: "3",
      project: "4",
      from: "2026-11-01",
      to: "2026-11-13",
      page: 2,
      entry: "12",
    });
  });

  it("drops values the backend would not accept", () => {
    const params = new URLSearchParams(
      "action=approve&model=a.b&user=x&project=-1&from=13/11/2026&to=2026-13-40&page=0&entry=abc",
    );

    expect(auditQueryFromParams(params)).toEqual({ ...noFilter, page: 1, entry: "" });
  });

  it("writes only what is set, and the page from 2", () => {
    expect(auditQueryParams({ ...noFilter, page: 1 }).toString()).toBe("");
    expect(
      auditQueryParams({ ...noFilter, search: "sidi", action: "delete", page: 3 }).toString(),
    ).toBe("q=sidi&action=delete&page=3");
  });
});

describe("audit filter menu", () => {
  it("round-trips the filters through the menu's state", () => {
    const filter: AuditFilter = {
      search: "sidi",
      action: "create",
      model: "Supplier",
      user: "3",
      project: "4",
      from: "2026-11-01",
      to: "",
    };

    expect(auditFilterFromState("sidi", auditFilterState(filter))).toMatchObject(filter);
    expect(auditFilterFromState("", noFilters)).toMatchObject(noFilter);
  });

  it("knows when a search or a filter is set", () => {
    expect(isAuditFiltered(noFilter)).toBe(false);
    expect(isAuditFiltered({ ...noFilter, to: "2026-11-13" })).toBe(true);
    expect(isAuditFiltered({ ...noFilter, action: "delete" })).toBe(true);
  });
});
