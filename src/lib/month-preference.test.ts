import { describe, expect, it } from "vitest";
import {
  CALENDAR_MONTH_COOKIE_NAME,
  isMonthPreference,
  parseMonthPreference,
} from "./month-preference";

describe("month preference", () => {
  it("uses a stable cookie name", () => {
    expect(CALENDAR_MONTH_COOKIE_NAME).toBe("schedule_selected_month");
  });

  it("accepts YYYY-MM month keys only", () => {
    expect(isMonthPreference("2026-06")).toBe(true);
    expect(isMonthPreference("2026-6")).toBe(false);
    expect(isMonthPreference("not-a-month")).toBe(false);
  });

  it("parses invalid cookie values as undefined", () => {
    expect(parseMonthPreference("2026-07")).toBe("2026-07");
    expect(parseMonthPreference("2026-7")).toBeUndefined();
    expect(parseMonthPreference(undefined)).toBeUndefined();
  });
});
