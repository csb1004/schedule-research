type CalendarSelectableDay = {
  date: string;
  inMonth: boolean;
};

export function getCalendarDateRange(
  days: CalendarSelectableDay[],
  startDate: string,
  endDate: string,
): string[] {
  const startIndex = days.findIndex((day) => day.date === startDate);
  const endIndex = days.findIndex((day) => day.date === endDate);

  if (startIndex === -1 || endIndex === -1) {
    return [];
  }

  const from = Math.min(startIndex, endIndex);
  const to = Math.max(startIndex, endIndex);

  return days
    .slice(from, to + 1)
    .filter((day) => day.inMonth)
    .map((day) => day.date);
}
