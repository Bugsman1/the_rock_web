import { describe, expect, it } from "vitest";
import {
  addHours,
  combineDateAndTime,
  durationParts,
  hoursBetween,
  isSameDay,
  displayDateToIso,
  isIsoDate,
  isTimeValue,
  isoDateToDisplay,
  maskDisplayDate,
  maskTimeValue,
  nowAsTimeValue,
  todayAsInputValue,
} from "./datetime";

describe("todayAsInputValue", () => {
  it("returns the Nouakchott date in the format a date input expects", () => {
    expect(todayAsInputValue(new Date("2026-10-07T23:30:00Z"))).toBe("2026-10-07");
  });

  it("does not roll over early in the UTC day", () => {
    expect(todayAsInputValue(new Date("2026-10-07T00:30:00Z"))).toBe("2026-10-07");
  });
});

describe("isIsoDate", () => {
  it("accepts a real calendar day", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
  });

  it("rejects an impossible day or another format", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("08/10/2026")).toBe(false);
  });
});

describe("isoDateToDisplay", () => {
  it("shows the day first", () => {
    expect(isoDateToDisplay("2026-10-08")).toBe("08/10/2026");
  });
});

describe("displayDateToIso", () => {
  it("reads a typed day back as an ISO date", () => {
    expect(displayDateToIso("08/10/2026")).toBe("2026-10-08");
  });

  it("gives nothing for an incomplete or impossible day", () => {
    expect(displayDateToIso("08/10/20")).toBeUndefined();
    expect(displayDateToIso("31/02/2026")).toBeUndefined();
  });
});

describe("maskDisplayDate", () => {
  it("adds the slashes while typing", () => {
    expect(maskDisplayDate("0810")).toBe("08/10");
    expect(maskDisplayDate("08102026")).toBe("08/10/2026");
  });

  it("drops letters and extra digits", () => {
    expect(maskDisplayDate("08a/10/20261")).toBe("08/10/2026");
  });

  it("lets a trailing slash be deleted", () => {
    expect(maskDisplayDate("08/")).toBe("08");
  });
});

describe("nowAsTimeValue", () => {
  it("returns hours and minutes", () => {
    expect(nowAsTimeValue(new Date("2026-10-05T08:05:00Z"))).toBe("08:05");
  });
});

describe("isTimeValue / maskTimeValue", () => {
  it("accepts a 24 hour time only", () => {
    expect(isTimeValue("23:59")).toBe(true);
    expect(isTimeValue("24:00")).toBe(false);
    expect(isTimeValue("7:30")).toBe(false);
  });

  it("adds the colon while typing", () => {
    expect(maskTimeValue("073")).toBe("07:3");
    expect(maskTimeValue("0730x9")).toBe("07:30");
    expect(maskTimeValue("07:")).toBe("07");
  });
});

describe("combineDateAndTime", () => {
  it("joins a day and a time into a timestamp", () => {
    expect(combineDateAndTime("2026-10-08", "14:30")).toBe("2026-10-08T14:30:00.000Z");
  });

  it("gives nothing when either part is invalid", () => {
    expect(combineDateAndTime("2026-10-08", "25:00")).toBeUndefined();
  });
});

describe("addHours / hoursBetween / isSameDay", () => {
  it("does hour arithmetic on timestamps", () => {
    expect(addHours("2026-10-08T22:00:00.000Z", 3)).toBe("2026-10-09T01:00:00.000Z");
    expect(hoursBetween("2026-10-08T08:00:00Z", "2026-10-08T10:30:00Z")).toBe(2.5);
    expect(isSameDay("2026-10-08T01:00:00Z", "2026-10-08T23:00:00Z")).toBe(true);
  });
});

describe("durationParts", () => {
  it("splits a span into hours and minutes", () => {
    expect(durationParts("2026-10-08T06:00:00Z", "2026-10-08T12:30:00Z")).toEqual({
      hours: 6,
      minutes: 30,
    });
    expect(durationParts("2026-10-08T06:00:00Z", "2026-10-08T05:00:00Z")).toEqual({
      hours: 0,
      minutes: 0,
    });
  });
});
