export const CALENDAR_MONTH_COOKIE_NAME = "schedule_selected_month";

const MONTH_PATTERN = /^\d{4}-\d{2}$/;

export function isMonthPreference(value: string | undefined): value is string {
  return typeof value === "string" && MONTH_PATTERN.test(value);
}

export function parseMonthPreference(
  value: string | undefined,
): string | undefined {
  return isMonthPreference(value) ? value : undefined;
}
