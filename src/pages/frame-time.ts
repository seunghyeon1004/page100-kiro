const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function two(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * The header clock of row 0, `Ddd DD Mon HH:MM:SS` in UTC, 19 characters (requirement 6.1).
 * Seconds are truncated. `date` must be a valid Date.
 */
export function formatHeaderClock(date: Date): string {
  const weekday = WEEKDAYS[date.getUTCDay()] ?? "???";
  const month = MONTHS[date.getUTCMonth()] ?? "???";
  return (
    `${weekday} ${two(date.getUTCDate())} ${month} ` +
    `${two(date.getUTCHours())}:${two(date.getUTCMinutes())}:${two(date.getUTCSeconds())}`
  );
}

/** `HH:MM UTC` for row 22 (requirement 7.2), 9 characters. `date` must be a valid Date. */
export function formatUtcTime(date: Date): string {
  return `${two(date.getUTCHours())}:${two(date.getUTCMinutes())} UTC`;
}
