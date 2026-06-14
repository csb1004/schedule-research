import { describe, expect, it } from "vitest";
import { emptyStatusCounts } from "./availability";
import {
  getHighlightColorName,
  parseHighlightStatusCookie,
  serializeHighlightStatuses,
} from "./highlight";
import type { Status } from "./status";

function countsWith(statuses: Partial<Record<Status, number>>) {
  return {
    ...emptyStatusCounts(),
    ...statuses,
  };
}

describe("highlight status preferences", () => {
  it("parses a cookie into deduped status priority order", () => {
    expect(
      parseHighlightStatusCookie(
        "AVAILABLE,UNAVAILABLE,INVALID,SPECIAL,AVAILABLE",
      ),
    ).toEqual(["UNAVAILABLE", "SPECIAL", "AVAILABLE"]);
  });

  it("serializes selected statuses in highlight priority order", () => {
    expect(
      serializeHighlightStatuses(["AVAILABLE", "MAYBE", "UNAVAILABLE"]),
    ).toBe("UNAVAILABLE,MAYBE,AVAILABLE");
  });

  it("returns no highlight color when nothing is selected", () => {
    expect(
      getHighlightColorName(
        countsWith({ UNAVAILABLE: 1, AVAILABLE: 1 }),
        [],
      ),
    ).toBeNull();
  });

  it("uses the first selected status with a count in red-yellow-blue-green order", () => {
    expect(
      getHighlightColorName(
        countsWith({ UNAVAILABLE: 1, MAYBE: 1, SPECIAL: 1, AVAILABLE: 1 }),
        ["AVAILABLE", "SPECIAL", "MAYBE", "UNAVAILABLE"],
      ),
    ).toBe("red");

    expect(
      getHighlightColorName(
        countsWith({ UNAVAILABLE: 1, MAYBE: 1, AVAILABLE: 1 }),
        ["AVAILABLE", "MAYBE"],
      ),
    ).toBe("yellow");

    expect(
      getHighlightColorName(
        countsWith({ SPECIAL: 1, AVAILABLE: 1 }),
        ["AVAILABLE", "SPECIAL"],
      ),
    ).toBe("blue");
  });
});
