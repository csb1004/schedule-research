export type MonthKey = `${number}-${string}`;

export type CalendarDay = {
  date: string;
  day: number;
  inMonth: boolean;
};

const ADMIN_MONTH_HORIZON = 12;

export function buildVisibleMonths(anchor: Date, extraMonths: string[]): string[] {
  const months = new Set<string>();
  const anchorMonth = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1),
  );

  for (let offset = 0; offset < 3; offset += 1) {
    months.add(formatMonth(addMonths(anchorMonth, offset)));
  }

  for (const month of extraMonths) {
    if (/^\d{4}-\d{2}$/.test(month)) {
      months.add(month);
    }
  }

  return [...months].sort();
}

export function buildAdminMonths(anchor: Date, storedMonths: string[]): string[] {
  const anchorMonth = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1),
  );
  const months = new Set<string>();

  for (let offset = 0; offset < ADMIN_MONTH_HORIZON; offset += 1) {
    months.add(formatMonth(addMonths(anchorMonth, offset)));
  }

  for (const month of storedMonths) {
    if (isMonthKey(month)) {
      months.add(month);
    }
  }

  return [...months].sort();
}

export function buildMonthSpanThroughLatestOpenMonth(
  anchor: Date,
  openMonths: string[],
): string[] {
  const currentMonth = formatMonth(
    new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1)),
  );
  const validOpenMonths = openMonths.filter(isMonthKey).sort();
  const latestOpenMonth = validOpenMonths.at(-1);

  if (!latestOpenMonth || latestOpenMonth < currentMonth) {
    return [currentMonth];
  }

  return buildMonthRange(currentMonth, latestOpenMonth);
}

export function buildMonthRange(startMonth: string, endMonth: string): string[] {
  const [startYear, startMonthNumber] = startMonth.split("-").map(Number);
  const [endYear, endMonthNumber] = endMonth.split("-").map(Number);
  const start = new Date(Date.UTC(startYear, startMonthNumber - 1, 1));
  const end = new Date(Date.UTC(endYear, endMonthNumber - 1, 1));
  const months: string[] = [];

  for (let cursor = start; cursor <= end; cursor = addMonths(cursor, 1)) {
    months.push(formatMonth(cursor));
  }

  return months;
}

export function buildMonthDays(month: string): CalendarDay[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const firstOfMonth = new Date(Date.UTC(year, monthNumber - 1, 1));
  const startOffset = firstOfMonth.getUTCDay();
  const start = addDays(firstOfMonth, -startOffset);
  const lastOfMonth = new Date(Date.UTC(year, monthNumber, 0));
  const endOffset = 6 - lastOfMonth.getUTCDay();
  const end = addDays(lastOfMonth, endOffset);
  const days: CalendarDay[] = [];

  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    days.push({
      date: formatDate(cursor),
      day: cursor.getUTCDate(),
      inMonth: cursor.getUTCMonth() === monthNumber - 1,
    });
  }

  return days;
}

export function getMonthDateRange(month: string): { start: string; end: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 0));

  return {
    start: formatDate(start),
    end: formatDate(end),
  };
}

export function enumerateDateRange(startDate: string, endDate: string): string[] {
  const start = parseDateKey(startDate);
  const end = parseDateKey(endDate);
  const dates: string[] = [];

  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    dates.push(formatDate(cursor));
  }

  return dates;
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatMonth(date: Date): string {
  return date.toISOString().slice(0, 7);
}

export function addMonths(date: Date, months: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function parseDateKey(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function isMonthKey(month: string): boolean {
  return /^\d{4}-\d{2}$/.test(month);
}
