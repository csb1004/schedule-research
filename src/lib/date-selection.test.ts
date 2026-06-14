import { describe, expect, it } from "vitest";
import { buildMonthDays } from "./calendar";
import { getCalendarDateRange } from "./date-selection";

describe("getCalendarDateRange", () => {
  it("selects every calendar date between the drag start and end dates", () => {
    const days = buildMonthDays("2026-06");

    expect(getCalendarDateRange(days, "2026-06-21", "2026-06-28")).toEqual([
      "2026-06-21",
      "2026-06-22",
      "2026-06-23",
      "2026-06-24",
      "2026-06-25",
      "2026-06-26",
      "2026-06-27",
      "2026-06-28",
    ]);
  });

  it("selects the same inclusive range when dragged backwards", () => {
    const days = buildMonthDays("2026-06");

    expect(getCalendarDateRange(days, "2026-06-28", "2026-06-21")).toEqual([
      "2026-06-21",
      "2026-06-22",
      "2026-06-23",
      "2026-06-24",
      "2026-06-25",
      "2026-06-26",
      "2026-06-27",
      "2026-06-28",
    ]);
  });

  it("ignores out-of-month dates when building a drag range", () => {
    const days = buildMonthDays("2026-06");

    expect(getCalendarDateRange(days, "2026-05-31", "2026-06-02")).toEqual([
      "2026-06-01",
      "2026-06-02",
    ]);
  });
});
