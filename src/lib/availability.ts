import type { Status } from "./status";

export type StatusCounts = Record<Status, number>;

export type AvailabilityEntry = {
  status: Status;
};

export type CalendarDaySummary<TEntry = unknown> = {
  date: string;
  isOpen: boolean;
  isVisible: boolean;
  counts: StatusCounts;
  entries: TEntry[];
};

export function emptyStatusCounts(): StatusCounts {
  return {
    UNAVAILABLE: 0,
    MAYBE: 0,
    SPECIAL: 0,
    AVAILABLE: 0,
  };
}

export function aggregateStatusCounts(
  entries: AvailabilityEntry[],
): StatusCounts {
  const counts = emptyStatusCounts();

  for (const entry of entries) {
    counts[entry.status] += 1;
  }

  return counts;
}

export function sanitizeClosedDayForUser<
  TEntry,
  TDay extends CalendarDaySummary<TEntry>,
>(
  day: TDay,
  isAdmin: boolean,
): TDay {
  if (day.isOpen || isAdmin) {
    return day;
  }

  return {
    ...day,
    counts: emptyStatusCounts(),
    entries: [],
  } as TDay;
}
