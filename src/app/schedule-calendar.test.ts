import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ScheduleCalendar special note UI", () => {
  it("does not use unsupported native browser prompt dialogs", () => {
    const source = readFileSync("src/app/schedule-calendar.tsx", "utf8");

    expect(source).not.toContain("window.prompt");
  });

  it("does not render short codes in visible user labels", () => {
    const source = readFileSync("src/app/schedule-calendar.tsx", "utf8");

    expect(source).not.toContain("#{currentUser.shortCode}");
    expect(source).not.toContain("#{entry.shortCode}");
  });

  it("lets the server decide whether the settings admin password is required", () => {
    const source = readFileSync("src/app/schedule-calendar.tsx", "utf8");
    const passwordInputStart = source.indexOf('name="adminPassword"');
    expect(passwordInputStart).toBeGreaterThan(-1);
    const passwordInputSource = source.slice(
      passwordInputStart,
      source.indexOf("/>", passwordInputStart),
    );

    expect(passwordInputSource).not.toContain("required");
  });

  it("marks the current user's date status and status button as active", () => {
    const source = readFileSync("src/app/schedule-calendar.tsx", "utf8");

    expect(source).toContain("currentUserEntry");
    expect(source).toContain("own-status");
    expect(source).toContain("aria-pressed");
    expect(source).toContain('? "active" : ""');
  });
});
