import type { StatusCounts } from "./availability";
import type { Status } from "./status";

export const HIGHLIGHT_COOKIE_NAME = "schedule_highlight_statuses";

export const HIGHLIGHT_STATUS_ORDER: Status[] = [
  "UNAVAILABLE",
  "MAYBE",
  "SPECIAL",
  "AVAILABLE",
];

export type HighlightColorName = "red" | "yellow" | "blue" | "green";

const HIGHLIGHT_COLOR_BY_STATUS: Record<Status, HighlightColorName> = {
  UNAVAILABLE: "red",
  MAYBE: "yellow",
  SPECIAL: "blue",
  AVAILABLE: "green",
};

export function parseHighlightStatusCookie(value: string | undefined): Status[] {
  const selected = new Set((value ?? "").split(","));

  return HIGHLIGHT_STATUS_ORDER.filter((status) => selected.has(status));
}

export function serializeHighlightStatuses(
  statuses: Iterable<Status>,
): string {
  const selected = new Set(statuses);

  return HIGHLIGHT_STATUS_ORDER.filter((status) => selected.has(status)).join(
    ",",
  );
}

export function getHighlightColorName(
  counts: StatusCounts,
  selectedStatuses: Iterable<Status>,
): HighlightColorName | null {
  const selected = new Set(selectedStatuses);

  for (const status of HIGHLIGHT_STATUS_ORDER) {
    if (selected.has(status) && counts[status] > 0) {
      return HIGHLIGHT_COLOR_BY_STATUS[status];
    }
  }

  return null;
}
