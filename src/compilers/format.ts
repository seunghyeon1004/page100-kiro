import { formatUtcTime } from "../pages/frame-time.js";

// The shared formatters of editorial.md, "Numbers and units" (rule-compilers requirement 2). Every
// number, date and time on a page is written here. Each function accepts any value, never throws,
// and returns `n/a` for null, non-finite, invalid or implausible input (Departure 3).

/** What a formatter prints when it has no value to show. */
export const NOT_AVAILABLE = "n/a";

/** An ISO time string, a Date, or nothing. */
export type TimeInput = string | Date | null;

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

/** Days in each month of a leap year, for `formatDayMonth`. */
const LEAP_MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

const FIRST_YEAR = 1970;
const LAST_YEAR = 2199;

const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;
const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function two(n: number): string {
  return String(n).padStart(2, "0");
}

function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

interface Rounded {
  /** The digits of the absolute value at the chosen precision, with a decimal point when needed. */
  readonly digits: string;
  /** The rounded value, signed; zero when every digit is zero. */
  readonly value: number;
}

/**
 * Rounds half away from zero on the exact binary value: `toFixed` picks the larger candidate on a
 * tie, which for an absolute value is the one away from zero. A result that prints as zero has no
 * sign (requirement 2.3). `x` must be finite with an absolute value under 1e21.
 */
function round(x: number, decimals: number): Rounded {
  const digits = Math.abs(x).toFixed(decimals);
  const magnitude = Number(digits);
  return { digits, value: x < 0 && magnitude !== 0 ? -magnitude : magnitude };
}

function withCommas(digits: string): string {
  const [whole = "", fraction] = digits.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

interface Spec {
  readonly min: number;
  readonly max: number;
  readonly decimals: number;
  readonly commas?: boolean;
  readonly plus?: boolean;
  readonly prefix?: string;
  readonly suffix?: string;
}

/** One number in one format: the range is tested on the raw value, then on the rounded one. */
function formatNumber(x: unknown, spec: Spec): string {
  if (!isFiniteNumber(x) || x < spec.min || x > spec.max) return NOT_AVAILABLE;
  const rounded = round(x, spec.decimals);
  if (rounded.value < spec.min || rounded.value > spec.max) return NOT_AVAILABLE;
  const body = spec.commas === true ? withCommas(rounded.digits) : rounded.digits;
  const sign = rounded.value < 0 ? "-" : rounded.value > 0 && spec.plus === true ? "+" : "";
  return `${spec.prefix ?? ""}${sign}${body}${spec.suffix ?? ""}`;
}

/** An integer from 0 to `max` (at most 99,999,999) with comma thousands separators: `12,400`. */
export function formatInteger(n: number | null, max: number): string {
  if (!isFiniteNumber(max) || max < 0) return NOT_AVAILABLE;
  return formatNumber(n, {
    min: 0,
    max: Math.min(Math.floor(max), 99_999_999),
    decimals: 0,
    commas: true,
  });
}

/** `-3°C`; from -100 to 100. */
export function formatTemperature(c: number | null): string {
  return formatNumber(c, { min: -100, max: 100, decimals: 0, suffix: "°C" });
}

/** `22 km/h`; from 0 to 999. */
export function formatWind(kmh: number | null): string {
  return formatNumber(kmh, { min: 0, max: 999, decimals: 0, suffix: " km/h" });
}

/** `3.5 mm`; from 0 to 999. */
export function formatPrecipitation(mm: number | null): string {
  return formatNumber(mm, { min: 0, max: 999, decimals: 1, suffix: " mm" });
}

/**
 * An exchange rate: 4 decimals when that print is under 10, else 2 decimals when that print is
 * under 1,000, else none. Over 0 and under 999,999.5, so that rounding never reaches 1,000,000.
 */
export function formatRate(rate: number | null): string {
  if (!isFiniteNumber(rate) || rate <= 0 || rate >= 999_999.5) return NOT_AVAILABLE;
  if (Number(round(rate, 4).digits) < 10) return round(rate, 4).digits;
  const twoDecimals = round(rate, 2);
  if (twoDecimals.value < 1000) return twoDecimals.digits;
  return withCommas(round(rate, 0).digits);
}

/** `+0.15%`, `-1.02%`, `0.00%`; from -999.99 to 999.99. */
export function formatChange(percent: number | null): string {
  return formatNumber(percent, { min: -999.99, max: 999.99, decimals: 2, plus: true, suffix: "%" });
}

/** `M5.2`; from -2 to 10. */
export function formatMagnitude(m: number | null): string {
  return formatNumber(m, { min: -2, max: 10, decimals: 1, prefix: "M" });
}

/** `10 km`; from -100 to 1,000. */
export function formatKm(km: number | null): string {
  return formatNumber(km, { min: -100, max: 1000, decimals: 0, commas: true, suffix: " km" });
}

/** `87%`; from 0 to 100. */
export function formatPercent(percent: number | null): string {
  return formatNumber(percent, { min: 0, max: 100, decimals: 0, suffix: "%" });
}

/** A valid Date in the years 1970 to 2199, from a Date or an ISO time string with a zone. */
function toDate(t: unknown): Date | undefined {
  let date: Date;
  if (t instanceof Date) {
    date = t;
  } else if (typeof t === "string" && ISO_TIME.test(t)) {
    date = new Date(Date.parse(t));
  } else {
    return undefined;
  }
  const ms = date.getTime();
  if (!Number.isFinite(ms)) return undefined;
  const year = date.getUTCFullYear();
  return year >= FIRST_YEAR && year <= LAST_YEAR ? date : undefined;
}

function dayText(date: Date): string {
  const weekday = WEEKDAYS[date.getUTCDay()] ?? NOT_AVAILABLE;
  const month = MONTHS[date.getUTCMonth()] ?? NOT_AVAILABLE;
  return `${weekday} ${two(date.getUTCDate())} ${month}`;
}

/** `14:05`, in UTC. */
export function formatTime(t: TimeInput): string {
  const date = toDate(t);
  return date === undefined
    ? NOT_AVAILABLE
    : `${two(date.getUTCHours())}:${two(date.getUTCMinutes())}`;
}

/** `14:05 UTC`: the same text as row 22 (requirement 2.6). */
export function formatTimeUtc(t: TimeInput): string {
  const date = toDate(t);
  return date === undefined ? NOT_AVAILABLE : formatUtcTime(date);
}

/** `Wed 11 Nov`, the UTC day of the time. */
export function formatDate(t: TimeInput): string {
  const date = toDate(t);
  return date === undefined ? NOT_AVAILABLE : dayText(date);
}

/** A real `YYYY-MM-DD` date in the years 1970 to 2199, as a UTC Date at midnight. */
function toCalendarDate(ymd: unknown): Date | undefined {
  if (typeof ymd !== "string") return undefined;
  const match = CALENDAR_DATE.exec(ymd);
  if (match === null) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const real =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return real && year >= FIRST_YEAR && year <= LAST_YEAR ? date : undefined;
}

/** `Wed 11 Nov` from `2026-11-11`. */
export function formatCalendarDate(ymd: string | null): string {
  const date = toCalendarDate(ymd);
  return date === undefined ? NOT_AVAILABLE : dayText(date);
}

/** `11 Nov 2026` from `2026-11-11`. */
export function formatFullDate(ymd: string | null): string {
  const date = toCalendarDate(ymd);
  if (date === undefined) return NOT_AVAILABLE;
  const month = MONTHS[date.getUTCMonth()] ?? NOT_AVAILABLE;
  return `${two(date.getUTCDate())} ${month} ${String(date.getUTCFullYear())}`;
}

/** `11 Nov` from a month (1 to 12) and a day that exists in some year (29 Feb included). */
export function formatDayMonth(month: number | null, day: number | null): string {
  if (!Number.isInteger(month) || !Number.isInteger(day)) return NOT_AVAILABLE;
  if (month === null || day === null || month < 1 || month > 12) return NOT_AVAILABLE;
  const days = LEAP_MONTH_DAYS[month - 1];
  if (days === undefined || day < 1 || day > days) return NOT_AVAILABLE;
  return `${two(day)} ${MONTHS[month - 1] ?? NOT_AVAILABLE}`;
}

/** `1066`, `44 BC`; an integer from -9,999 to 9,999 except 0. */
export function formatYear(year: number | null): string {
  if (!isFiniteNumber(year) || !Number.isInteger(year) || year === 0) return NOT_AVAILABLE;
  if (year < -9999 || year > 9999) return NOT_AVAILABLE;
  return year < 0 ? `${String(-year)} BC` : String(year);
}
