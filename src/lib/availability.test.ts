import { describe, expect, it } from "vitest";
import {
  aggregateStatusCounts,
  emptyStatusCounts,
  shouldClearAvailability,
  sanitizeClosedDayForUser,
} from "./availability";

describe("aggregateStatusCounts", () => {
  it("counts all statuses and includes zero defaults", () => {
    expect(
      aggregateStatusCounts([
        { status: "AVAILABLE" },
        { status: "AVAILABLE" },
        { status: "SPECIAL" },
      ]),
    ).toEqual({
      UNAVAILABLE: 0,
      MAYBE: 0,
      SPECIAL: 1,
      AVAILABLE: 2,
    });
  });
});

describe("shouldClearAvailability", () => {
  it("clears an availability when the same status is selected again", () => {
    expect(shouldClearAvailability("AVAILABLE", "AVAILABLE")).toBe(true);
  });

  it("keeps an availability when a different status is selected", () => {
    expect(shouldClearAvailability("AVAILABLE", "MAYBE")).toBe(false);
  });
});

describe("sanitizeClosedDayForUser", () => {
  it("hides closed-date counts and entries from normal users", () => {
    expect(
      sanitizeClosedDayForUser(
        {
          date: "2026-06-04",
          isOpen: false,
          isVisible: true,
          counts: { UNAVAILABLE: 1, MAYBE: 1, SPECIAL: 1, AVAILABLE: 1 },
          entries: [{ userName: "Alex", status: "AVAILABLE" }],
        },
        false,
      ),
    ).toMatchObject({
      isOpen: false,
      counts: emptyStatusCounts(),
      entries: [],
    });
  });

  it("keeps closed-date details visible for admins", () => {
    const day = {
      date: "2026-06-04",
      isOpen: false,
      isVisible: true,
      counts: { UNAVAILABLE: 1, MAYBE: 0, SPECIAL: 0, AVAILABLE: 2 },
      entries: [{ userName: "Alex", status: "AVAILABLE" }],
    };

    expect(sanitizeClosedDayForUser(day, true)).toEqual(day);
  });
});
