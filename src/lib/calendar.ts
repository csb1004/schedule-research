export type MonthKey = `${number}-${string}`;

export type CalendarDay = {
  date: string;
  day: number;
  inMonth: boolean;
};

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

export function buildMonthDays(month: string): CalendarDay[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const firstOfMonth = new Date(Date.UTC(year, monthNumber - 1, 1));
  const startOffset = (firstOfMonth.getUTCDay() + 6) % 7;
  const start = addDays(firstOfMonth, -startOffset);
  const lastOfMonth = new Date(Date.UTC(year, monthNumber, 0));
  const endOffset = 6 - ((lastOfMonth.getUTCDay() + 6) % 7);
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

