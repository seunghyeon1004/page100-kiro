import type { SeriesPoint } from "../sources/frankfurter.js";
import { lineChart } from "./chart.js";
import { CYAN, WHITE, YELLOW, entryTime, finishPage } from "./compile-helpers.js";
import { SERIES_CODES } from "./city-data.js";
import type { CompileResult, SourceEntry } from "./compile-types.js";
import { createContentBuilder } from "./content-builder.js";
import type { BuildResult } from "./content-builder.js";
import { CURRENCY_NAMES } from "./currency-names.js";
import { formatCalendarDate, formatRate } from "./format.js";
import { canvasToCells } from "./mosaic-canvas.js";
import { noDataPage } from "./no-data-page.js";

// Page 301: the rate trend, one subpage per currency (rule-compilers requirement 12.2, design.md,
// "Page layouts").

const CHART_COL = 8;
const CHART_COLS = 32;
const CHART_ROWS = 12;

function right(text: string, end: number): number {
  return end + 1 - Array.from(text).length;
}

/** The point with the largest (or smallest) rate; the earliest date on a tie. */
function extreme(points: readonly SeriesPoint[], highest: boolean): SeriesPoint | undefined {
  let best: SeriesPoint | undefined;
  for (const point of points) {
    if (best === undefined || (highest ? point.rate > best.rate : point.rate < best.rate)) {
      best = point;
    }
  }
  return best;
}

function subpage(code: string, unsorted: readonly SeriesPoint[]): BuildResult {
  const b = createContentBuilder();
  const points = [...unsorted].sort((a, c) => (a.date < c.date ? -1 : a.date > c.date ? 1 : 0));
  const name = CURRENCY_NAMES[code] ?? code;
  b.heading(0, 1, `${name} (${code}) per US dollar`, YELLOW);

  const rates = points.map((p) => p.rate);
  const high = extreme(points, true);
  const low = extreme(points, false);
  const topLabel = formatRate(high?.rate ?? null);
  const bottomLabel = formatRate(low?.rate ?? null);
  b.text(1, right(topLabel, 6), topLabel, WHITE);
  b.text(CHART_ROWS, right(bottomLabel, 6), bottomLabel, WHITE);
  b.cells(1, CHART_COL, canvasToCells(lineChart(rates, CHART_COLS, CHART_ROWS), CYAN));

  const first = formatCalendarDate(points[0]?.date ?? null);
  const last = formatCalendarDate(points[points.length - 1]?.date ?? null);
  b.text(13, CHART_COL, first, WHITE);
  b.text(13, right(last, 39), last, WHITE);

  const summary: [string, SeriesPoint | undefined][] = [
    ["Latest", points[points.length - 1]],
    ["Highest", high],
    ["Lowest", low],
  ];
  summary.forEach(([label, point], i) => {
    const rate = formatRate(point?.rate ?? null);
    const date = formatCalendarDate(point?.date ?? null);
    b.text(15 + i, 1, label, CYAN);
    b.text(15 + i, right(rate, 17), rate, WHITE);
    b.text(15 + i, 19, date, WHITE);
    b.alt({ kind: "paragraph", text: `${label} ${rate} ${date}` });
  });
  b.alt({
    kind: "table",
    headers: ["Date", "Rate"],
    rows: points.map((p) => [formatCalendarDate(p.date), formatRate(p.rate)]),
  });
  return b.build();
}

export function compile301(entry: SourceEntry<"frankfurter">): CompileResult {
  const built: BuildResult[] = [];
  for (const code of SERIES_CODES) {
    const series = entry.value.series.find((s) => s.code === code);
    if (series === undefined || series.points.length < 2) continue;
    built.push(subpage(code, series.points));
  }
  if (built.length === 0) return noDataPage(301, "no-data");
  return finishPage(301, built, entryTime(entry.fetchedAt));
}
