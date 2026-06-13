import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ScheduleCalendar special note UI", () => {
  it("does not use unsupported native browser prompt dialogs", () => {
    const source = readFileSync("src/app/schedule-calendar.tsx", "utf8");

    expect(source).not.toContain("window.prompt");
  });
});

