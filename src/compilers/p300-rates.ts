import type { Rates } from "../sources/frankfurter.js";
import { CYAN, GREEN, RED, WHITE, YELLOW, entryTime, finishPage } from "./compile-helpers.js";
import { SERIES_CODES } from "./city-data.js";
import type { CompileResult, SourceEntry } from "./compile-types.js";
import { createContentBuilder } from "./content-builder.js";
import { CURRENCY_NAMES, OTHER_CODES } from "./currency-names.js";
import { formatChange, formatFullDate, formatRate } from "./format.js";
import { noDataPage } from "./no-data-page.js";

// Page 300: exchange rates (rule-compilers requirement 12.1, owner answer 3, design.md, "Page layouts").

function right(text: string, end: number): number {
  return end + 1 - Array.from(text).length;
}

function rateOf(rates: Rates, code: string): number | null {
  return rates.rates.find((r) => r.code === code)?.rate ?? null;
}

/** The change on the day, in percent: latest against the last series point dated before `Rates.date`. */
export function changeOnTheDay(rates: Rates, code: string): number | null {
  const latest = rateOf(rates, code);
  if (latest === null) return null;
  const series = rates.series.find((s) => s.code === code);
  let previous: { date: string; rate: number } | undefined;
  for (const point of series?.points ?? []) {
    if (point.date < rates.date && (previous === undefined || point.date >= previous.date)) {
      previous = point;
    }
  }
  if (previous === undefined || previous.rate <= 0) return null;
  return (latest / previous.rate - 1) * 100;
}

export function compile300(entry: SourceEntry<"frankfurter">): CompileResult {
  const rates = entry.value;
  const codes = [...SERIES_CODES, ...OTHER_CODES];
  if (!codes.some((code) => rateOf(rates, code) !== null)) return noDataPage(300, "no-data");

  const b = createContentBuilder();
  b.heading(0, 1, `Rates per US dollar, ${formatFullDate(rates.date)}`, YELLOW);
  b.text(2, 1, "Currency", CYAN);
  b.text(2, 20, "Code", CYAN);
  b.text(2, right("Rate", 30), "Rate", CYAN);
  b.text(2, right("Change", 39), "Change", CYAN);

  const main: string[][] = [];
  SERIES_CODES.forEach((code, i) => {
    const name = CURRENCY_NAMES[code] ?? code;
    const rate = formatRate(rateOf(rates, code));
    const change = formatChange(changeOnTheDay(rates, code));
    const colour = change.startsWith("+") ? GREEN : change.startsWith("-") ? RED : WHITE;
    const row = 3 + i;
    b.text(row, 1, name, WHITE);
    b.text(row, 20, code, YELLOW);
    b.text(row, right(rate, 30), rate, WHITE);
    b.text(row, right(change, 39), change, colour);
    main.push([name, code, rate, change]);
  });
  b.alt({ kind: "table", headers: ["Currency", "Code", "Rate", "Change"], rows: main });

  const hasOther = OTHER_CODES.some((code) => rateOf(rates, code) !== null);
  if (hasOther) b.heading(10, 1, "Other rates", CYAN, 2);
  const other: string[][] = [];
  OTHER_CODES.forEach((code, i) => {
    const latest = rateOf(rates, code);
    if (latest === null) return;
    const rate = formatRate(latest);
    const left = i < 5;
    const row = 11 + (i % 5);
    b.text(row, left ? 1 : 21, code, YELLOW);
    b.text(row, right(rate, left ? 11 : 31), rate, WHITE);
    other.push([CURRENCY_NAMES[code] ?? code, code, rate]);
  });
  if (other.length > 0) {
    b.alt({ kind: "table", headers: ["Currency", "Code", "Rate"], rows: other });
  }
  b.lines(17, 1, ["Change is against the previous ECB", "reference date in the series."]);
  return finishPage(300, [b.build()], entryTime(entry.fetchedAt));
}
