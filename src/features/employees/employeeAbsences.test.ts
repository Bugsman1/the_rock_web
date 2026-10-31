import { describe, expect, it } from "vitest";
import {
  absenceErrorsFromApi,
  absenceFromApi,
  absenceToApi,
  createAbsenceSchema,
  isAbsenceField,
} from "./employeeAbsences";
import { apiAbsence } from "./employeesTesting";

const schema = createAbsenceSchema({
  required: "required",
  dateInvalid: "date",
  endBeforeStart: "endBeforeStart",
});

function issues(result: { error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  return (result.error?.issues ?? []).map((issue) => [issue.path.join("."), issue.message]);
}

describe("absence form", () => {
  it("takes a start date alone, an end date on or after it, and trims the reason", () => {
    expect(schema.parse({ from: "2026-10-05", to: "", reason: " Malade " })).toEqual({
      from: "2026-10-05",
      to: "",
      reason: "Malade",
    });
    expect(schema.safeParse({ from: "2026-10-05", to: "2026-10-05", reason: "" }).success).toBe(
      true,
    );
  });

  it("needs a real start date and refuses an end before it", () => {
    expect(issues(schema.safeParse({ from: "", to: "2026-13-01", reason: "" }))).toEqual([
      ["from", "required"],
      ["to", "date"],
    ]);
    expect(issues(schema.safeParse({ from: "2026-10-05", to: "2026-10-04", reason: "" }))).toEqual([
      ["to", "endBeforeStart"],
    ]);
  });

  it("knows its fields", () => {
    expect(isAbsenceField("to")).toBe(true);
    expect(isAbsenceField("days")).toBe(false);
  });
});

describe("absences from and to the backend", () => {
  it("reads the days the backend counted", () => {
    expect(absenceFromApi(apiAbsence(4))).toEqual({
      id: "4",
      from: "2026-10-05",
      to: "2026-10-07",
      days: 3,
      reason: "Malade",
      byName: "admin",
    });
  });

  it("sends one day when no end date is typed", () => {
    expect(absenceToApi({ from: "2026-10-05", to: "", reason: "" })).toEqual({
      start_date: "2026-10-05",
      end_date: "2026-10-05",
      reason: "",
    });
    expect(absenceToApi({ from: "2026-10-05", to: "2026-10-09", reason: "Congé" })).toMatchObject({
      end_date: "2026-10-09",
    });
  });

  it("puts the backend's messages on the form's fields", () => {
    expect(
      absenceErrorsFromApi({ start_date: "Déjà absent", end_date: "Après la fin", employee: "x" }),
    ).toEqual({ from: "Déjà absent", to: "Après la fin" });
  });
});
