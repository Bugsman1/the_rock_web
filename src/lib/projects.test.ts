import { describe, expect, it } from "vitest";
import {
  createGrinderSchema,
  createProjectSchema,
  findProject,
  grinderErrorsFromApi,
  grinderFromApi,
  grinderToApi,
  grindersOfProject,
  isGrinderField,
  isInService,
  isProjectField,
  isRecordId,
  isSiteKey,
  projectErrorsFromApi,
  projectFromApi,
  projectToApi,
} from "./projects";
import type { Grinder, Project } from "./projects";

const projects: readonly Project[] = [
  { id: "1", name: "Zouérat 1", site: "zouerat", status: "active" },
  { id: "2", name: "Sfariyat 1", site: "sfariyat", status: "inactive" },
];

const grinders: readonly Grinder[] = [
  { id: "10", project: "1", number: 7, status: "active" },
  { id: "11", project: "2", number: 1, status: "active" },
  { id: "12", project: "1", number: 2, status: "maintenance" },
];

describe("isRecordId", () => {
  it("accepts a backend id only", () => {
    expect(isRecordId("12")).toBe(true);
    expect(isRecordId("zouerate1")).toBe(false);
    expect(isRecordId("../1")).toBe(false);
    expect(isRecordId("")).toBe(false);
  });
});

describe("isSiteKey", () => {
  it("knows the two sites", () => {
    expect(isSiteKey("zouerat")).toBe(true);
    expect(isSiteKey("sfariyat")).toBe(true);
    expect(isSiteKey("atar")).toBe(false);
  });
});

describe("isInService", () => {
  it("keeps active and maintenance, not inactive", () => {
    expect(isInService({ status: "active" })).toBe(true);
    expect(isInService({ status: "maintenance" })).toBe(true);
    expect(isInService({ status: "inactive" })).toBe(false);
  });
});

describe("findProject", () => {
  it("finds a project by id", () => {
    expect(findProject(projects, "2")?.name).toBe("Sfariyat 1");
    expect(findProject(projects, "9")).toBeUndefined();
  });
});

describe("grindersOfProject", () => {
  it("lists the grinders of one project by number", () => {
    expect(grindersOfProject(grinders, "1").map((grinder) => grinder.number)).toEqual([2, 7]);
  });
});

describe("createProjectSchema", () => {
  const schema = createProjectSchema({ required: "required" });

  it("accepts a named project on a known site", () => {
    expect(
      schema.safeParse({ name: " Zouérat 2 ", site: "zouerat", status: "active" }).data,
    ).toEqual({ name: "Zouérat 2", site: "zouerat", status: "active" });
  });

  it("requires a name", () => {
    const result = schema.safeParse({ name: " ", site: "zouerat", status: "active" });

    expect(result.error?.issues[0]?.message).toBe("required");
  });
});

describe("createGrinderSchema", () => {
  const schema = createGrinderSchema({ numberInvalid: "numberInvalid" });

  it("accepts a whole machine number from 1 to 9999", () => {
    expect(schema.safeParse({ number: 7, status: "maintenance" }).success).toBe(true);
  });

  it("refuses any other number", () => {
    for (const number of [0, 1.5, 10000, Number.NaN]) {
      expect(schema.safeParse({ number, status: "active" }).error?.issues[0]?.message).toBe(
        "numberInvalid",
      );
    }
  });
});

const stamps = {
  is_active: true,
  created_at: "2026-10-01T08:00:00Z",
  updated_at: "2026-10-01T08:00:00Z",
};

describe("projectFromApi", () => {
  it("turns a backend project into ours", () => {
    expect(
      projectFromApi({
        id: 3,
        name: "Zouérat 1",
        site: "zouerat",
        status: "maintenance",
        ...stamps,
      }),
    ).toEqual({ id: "3", name: "Zouérat 1", site: "zouerat", status: "maintenance" });
  });

  it("counts a project without status as active", () => {
    expect(projectFromApi({ id: 3, name: "Zouérat 1", site: "zouerat", ...stamps }).status).toBe(
      "active",
    );
  });
});

describe("projectToApi", () => {
  it("sends the trimmed name, the site and the status", () => {
    expect(projectToApi({ name: " Sfariyat 3 ", site: "sfariyat", status: "active" })).toEqual({
      name: "Sfariyat 3",
      site: "sfariyat",
      status: "active",
    });
  });
});

describe("projectErrorsFromApi", () => {
  it("puts the backend errors on our fields", () => {
    expect(projectErrorsFromApi({ name: "Trop long.", other: "x" })).toEqual({
      name: "Trop long.",
    });
  });
});

describe("grinderFromApi", () => {
  it("reads the grinder number from its code", () => {
    expect(
      grinderFromApi({
        id: 9,
        project: 3,
        code: "P3-7",
        status: "maintenance",
        ...stamps,
      }),
    ).toEqual([{ id: "9", project: "3", number: 7, status: "maintenance" }]);
  });

  it("skips a grinder whose code is not one of ours or belongs to another project", () => {
    expect(grinderFromApi({ id: 9, project: 3, code: "BROYEUR-A", ...stamps })).toEqual([]);
    expect(grinderFromApi({ id: 9, project: 3, code: "P4-7", ...stamps })).toEqual([]);
  });
});

describe("grinderToApi", () => {
  it("sends the number inside a code unique to the project", () => {
    expect(grinderToApi({ number: 7, status: "active" }, "3")).toEqual({
      project: 3,
      code: "P3-7",
      status: "active",
    });
  });
});

describe("grinderErrorsFromApi", () => {
  it("shows a code error on the number", () => {
    expect(grinderErrorsFromApi({ code: "Existe déjà.", status: "Invalide." })).toEqual({
      number: "Existe déjà.",
      status: "Invalide.",
    });
  });
});

describe("isProjectField and isGrinderField", () => {
  it("knows the form fields only", () => {
    expect(isProjectField("site")).toBe(true);
    expect(isProjectField("code")).toBe(false);
    expect(isGrinderField("number")).toBe(true);
    expect(isGrinderField("name")).toBe(false);
  });
});
