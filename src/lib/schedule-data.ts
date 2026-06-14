import { prisma } from "@/lib/prisma";
import {
  aggregateStatusCounts,
  sanitizeClosedDayForUser,
  type StatusCounts,
} from "@/lib/availability";
import {
  buildAdminMonths,
  buildMonthDays,
  buildMonthSpanThroughLatestOpenMonth,
  formatMonth,
  parseDateKey,
} from "@/lib/calendar";
import type { Status } from "@/lib/status";

export type ScheduleUser = {
  id: string;
  displayName: string;
  shortCode: string;
};

export type ScheduleEntry = {
  id: string;
  userId: string;
  userName: string;
  shortCode: string;
  status: Status;
  reason: string | null;
};

export type ScheduleDay = {
  date: string;
  day: number;
  inMonth: boolean;
  isOpen: boolean;
  isVisible: boolean;
  counts: StatusCounts;
  entries: ScheduleEntry[];
};

export type ScheduleData = {
  months: string[];
  selectedMonth: string;
  days: ScheduleDay[];
};

export async function loadScheduleData(
  selectedMonthInput: string | undefined,
  isAdmin: boolean,
): Promise<ScheduleData> {
  const today = new Date();
  const visibleDayRows = await prisma.day.findMany({
    where: { isVisible: true },
    select: { date: true, isOpen: true },
  });
  const storedVisibleMonths = visibleDayRows.map((day) => formatMonth(day.date));
  const openVisibleMonths = visibleDayRows
    .filter((day) => day.isOpen)
    .map((day) => formatMonth(day.date));
  const months = isAdmin
    ? buildAdminMonths(today, storedVisibleMonths)
    : buildMonthSpanThroughLatestOpenMonth(today, openVisibleMonths);
  const fallbackMonth = formatMonth(today);
  const selectedMonth =
    selectedMonthInput && months.includes(selectedMonthInput)
      ? selectedMonthInput
      : months.includes(fallbackMonth)
        ? fallbackMonth
        : months[0];
  const calendarDays = buildMonthDays(selectedMonth);
  const dateKeys = calendarDays.map((day) => day.date);
  const dateObjects = dateKeys.map(parseDateKey);
  const [dayRows, availabilityRows] = await Promise.all([
    prisma.day.findMany({
      where: { date: { in: dateObjects } },
    }),
    prisma.availability.findMany({
      where: { date: { in: dateObjects } },
      include: { user: true },
      orderBy: [{ user: { displayName: "asc" } }, { createdAt: "asc" }],
    }),
  ]);

  const dayRowsByDate = new Map(
    dayRows.map((day) => [day.date.toISOString().slice(0, 10), day]),
  );
  const entriesByDate = new Map<string, ScheduleEntry[]>();

  for (const row of availabilityRows) {
    const date = row.date.toISOString().slice(0, 10);
    const entries = entriesByDate.get(date) ?? [];
    entries.push({
      id: row.id,
      userId: row.userId,
      userName: row.user.displayName,
      shortCode: row.user.shortCode,
      status: row.status,
      reason: row.reason,
    });
    entriesByDate.set(date, entries);
  }

  const days = calendarDays.map((calendarDay) => {
    const dayRow = dayRowsByDate.get(calendarDay.date);
    const entries = entriesByDate.get(calendarDay.date) ?? [];
    const summary = sanitizeClosedDayForUser(
      {
        ...calendarDay,
        isOpen: dayRow?.isOpen ?? true,
        isVisible: dayRow?.isVisible ?? true,
        counts: aggregateStatusCounts(entries),
        entries,
      },
      isAdmin,
    );

    return summary;
  });

  return {
    months,
    selectedMonth,
    days,
  };
}
