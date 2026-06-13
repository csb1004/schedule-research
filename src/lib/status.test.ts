import { describe, expect, it } from "vitest";
import { STATUS_SLOTS } from "./status";

describe("STATUS_SLOTS", () => {
  it("keeps date-cell status slots in the approved fixed order", () => {
    expect(STATUS_SLOTS.map((slot) => slot.status)).toEqual([
      "UNAVAILABLE",
      "MAYBE",
      "SPECIAL",
      "AVAILABLE",
    ]);
  });
});

