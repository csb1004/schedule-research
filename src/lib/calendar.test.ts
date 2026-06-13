import { describe, expect, it } from "vitest";
import { buildMonthDays, buildVisibleMonths } from "./calendar";

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

describe("buildMonthDays", () => {
  it("builds calendar cells starting on Monday and ending on Sunday", () => {
    const days = buildMonthDays("2026-06");

    expect(days[0]?.date).toBe("2026-06-01");
    expect(days[0]?.inMonth).toBe(true);
    expect(days.at(-1)?.date).toBe("2026-07-05");
    expect(days.at(-1)?.inMonth).toBe(false);
    expect(days).toHaveLength(35);
  });
});

