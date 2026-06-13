import { describe, expect, it } from "vitest";
import {
  aggregateStatusCounts,
  emptyStatusCounts,
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

