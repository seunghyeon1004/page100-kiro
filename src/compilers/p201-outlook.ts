import type { CityWeather } from "../sources/open-meteo.js";
import { rangeBars } from "./chart.js";
import type { Range } from "./chart.js";
import { OUTLOOK_IDS, cityName } from "./city-data.js";
import { CYAN, WHITE, YELLOW, entryTime, finishPage } from "./compile-helpers.js";
import type { CompileResult, SourceEntry } from "./compile-types.js";
import { createContentBuilder } from "./content-builder.js";
import type { BuildResult } from "./content-builder.js";
import { formatCalendarDate, formatPercent, formatTemperature } from "./format.js";
import { canvasToCells } from "./mosaic-canvas.js";
import { noDataPage } from "./no-data-page.js";
import { weatherKind, weatherLabel } from "./weather-symbol.js";

// Page 201: the five-day outlook, one subpage per city (rule-compilers requirement 11.2,
// design.md, "Page layouts").

const DAYS = 5;
const CHART_COL = 7;
const CHART_COLS = 32;
const CHART_ROWS = 8;

function right(text: string, end: number): number {
  return end + 1 - Array.from(text).length;
}

function subpage(city: CityWeather): BuildResult {
  const b = createContentBuilder();
  const name = cityName(city.cityId);
  const days = city.daily.slice(0, DAYS);
  b.heading(0, 1, name, YELLOW);

  const highs = days.flatMap((d) => (d.maxC === null ? [] : [d.maxC]));
  const lows = days.flatMap((d) => (d.minC === null ? [] : [d.minC]));
  const ranges = days.map((d): Range | null =>
    d.maxC === null || d.minC === null ? null : { low: d.minC, high: d.maxC },
  );
  const top = formatTemperature(highs.length === 0 ? null : Math.max(...highs));
  const bottom = formatTemperature(lows.length === 0 ? null : Math.min(...lows));
  b.text(1, right(top, 5), top, WHITE);
  b.text(CHART_ROWS, right(bottom, 5), bottom, WHITE);
  b.cells(1, CHART_COL, canvasToCells(rangeBars(ranges, CHART_COLS, CHART_ROWS), YELLOW));

  const rows: string[][] = [];
  b.text(11, 1, "Day", CYAN);
  b.text(11, 12, "Weather", CYAN);
  b.text(11, right("High", 26), "High", CYAN);
  b.text(11, right("Low", 33), "Low", CYAN);
  b.text(11, right("Rain", 39), "Rain", CYAN);
  days.forEach((day, i) => {
    const date = formatCalendarDate(day.date);
    const label = weatherLabel(weatherKind(day.weatherCode));
    const high = formatTemperature(day.maxC);
    const low = formatTemperature(day.minC);
    const rain = formatPercent(day.precipitationPct);
    const row = 12 + i;
    b.text(row, 1, date, WHITE);
    b.text(row, 12, label, WHITE);
    b.text(row, right(high, 26), high, WHITE);
    b.text(row, right(low, 33), low, WHITE);
    b.text(row, right(rain, 39), rain, WHITE);
    rows.push([date, label, high, low, rain]);

    // The weekday under the middle of the day's bar.
    const centre = CHART_COL + Math.floor(((i + 0.5) * CHART_COLS) / days.length);
    b.text(9, centre - 1, date.slice(0, 3), WHITE);
  });
  b.alt({ kind: "table", headers: ["Day", "Weather", "High", "Low", "Rain"], rows });
  return b.build();
}

export function compile201(entry: SourceEntry<"open-meteo">): CompileResult {
  const built: BuildResult[] = [];
  for (const id of OUTLOOK_IDS) {
    const city = entry.value.cities.find((c) => c.cityId === id);
    if (city === undefined || city.daily.length === 0) continue;
    built.push(subpage(city));
  }
  if (built.length === 0) return noDataPage(201, "no-data");
  return finishPage(201, built, entryTime(entry.fetchedAt));
}
