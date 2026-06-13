import { describe, expect, it } from "vitest";
import {
  buildMonthDays,
  buildVisibleMonths,
  enumerateDateRange,
  getMonthDateRange,
} from "./calendar";

describe("buildVisibleMonths", () => {
  it("returns the current month and next two months by default", () => {
    expect(buildVisibleMonths(new Date("2026-06-13T00:00:00Z"), [])).toEqual([
      "2026-06",
      "2026-07",
      "2026-08",
    ]);
  });

  it("adds extra months once and keeps the result sorted", () => {
    expect(
      buildVisibleMonths(new Date("2026-06-13T00:00:00Z"), [
        "2026-10",
        "2026-05",
        "2026-10",
      ]),
    ).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-10"]);
  });
});

describe("date range helpers", () => {
  it("returns the first and last date keys for a month", () => {
    expect(getMonthDateRange("2026-02")).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
    });
  });

  it("enumerates date keys inclusively", () => {
    expect(enumerateDateRange("2026-06-29", "2026-07-02")).toEqual([
      "2026-06-29",
      "2026-06-30",
      "2026-07-01",
      "2026-07-02",
    ]);
  });
});

describe("buildMonthDays", () => {
  it("builds calendar cells starting on Sunday and ending on Saturday", () => {
    const days = buildMonthDays("2026-06");

    expect(days[0]?.date).toBe("2026-05-31");
    expect(days[0]?.inMonth).toBe(false);
    expect(days.at(-1)?.date).toBe("2026-07-04");
    expect(days.at(-1)?.inMonth).toBe(false);
    expect(days).toHaveLength(35);
  });
});
