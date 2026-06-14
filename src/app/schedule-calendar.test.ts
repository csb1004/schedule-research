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

  it("uses date number color rather than a badge for the current user's date status", () => {
    const source = readFileSync("src/app/schedule-calendar.tsx", "utf8");
    const styles = readFileSync("src/app/globals.css", "utf8");

    expect(source).toContain("own-${ownStatusColor}");
    expect(source).not.toContain("own-status-badge");
    expect(styles).toContain(".date-cell.own-red .day-number");
    expect(styles).not.toContain(".status-slot.mine");
  });

  it("can close the selected date detail panel", () => {
    const source = readFileSync("src/app/schedule-calendar.tsx", "utf8");
    const styles = readFileSync("src/app/globals.css", "utf8");

    expect(source).toContain("function closeDetailPanel()");
    expect(source).toContain("setSelectedDate(null)");
    expect(source).toContain("detail-close-button");
    expect(styles).toContain(".calendar-workspace.detail-closed");
  });

  it("renders a persisted multi-select highlight filter next to multi date selection", () => {
    const source = readFileSync("src/app/schedule-calendar.tsx", "utf8");
    const styles = readFileSync("src/app/globals.css", "utf8");

    expect(source).toContain("highlightMenuOpen");
    expect(source).toContain("HIGHLIGHT_COOKIE_NAME");
    expect(source).toContain("하이라이트 없음");
    expect(source).toContain("highlightStatuses");
    expect(styles).toContain(".highlight-menu");
  });

  it("applies highlight background classes to date cells", () => {
    const source = readFileSync("src/app/schedule-calendar.tsx", "utf8");
    const styles = readFileSync("src/app/globals.css", "utf8");

    expect(source).toContain("highlightColorName");
    expect(source).toContain("highlight-${highlightColorName}");
    expect(styles).toContain(".date-cell.highlight-red");
    expect(styles).toContain(".date-cell.highlight-green");
  });

  it("enters multi-select mode from a long-pressed date and supports drag range selection", () => {
    const source = readFileSync("src/app/schedule-calendar.tsx", "utf8");

    expect(source).toContain("LONG_PRESS_DELAY_MS");
    expect(source).toContain("handleDatePointerDown");
    expect(source).toContain("handleDatePointerEnter");
    expect(source).toContain("dragSelectionAnchorDate");
    expect(source).toContain("getCalendarDateRange");
  });

  it("persists the selected calendar month in a cookie", () => {
    const source = readFileSync("src/app/schedule-calendar.tsx", "utf8");
    const pageSource = readFileSync("src/app/page.tsx", "utf8");

    expect(source).toContain("writeCalendarMonthCookie");
    expect(source).toContain("CALENDAR_MONTH_COOKIE_NAME");
    expect(pageSource).toContain("parseMonthPreference");
    expect(pageSource).toContain("cookies()");
  });
});
