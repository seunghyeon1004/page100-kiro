import type { CityWeather } from "../sources/open-meteo.js";
import { REGION_LIST, cityName } from "./city-data.js";
import { CYAN, WHITE, YELLOW, entryTime, finishPage } from "./compile-helpers.js";
import type { CompileResult, SourceEntry } from "./compile-types.js";
import { createContentBuilder } from "./content-builder.js";
import type { BuildResult } from "./content-builder.js";
import { formatTemperature, formatWind } from "./format.js";
import { noDataPage } from "./no-data-page.js";
import { symbolCells, weatherKind, weatherLabel } from "./weather-symbol.js";

// Page 200: world weather now, one subpage per region (rule-compilers requirement 11.1, design.md,
// "Page layouts").

const TEMP_END = 28;
const WIND_END = 38;

function right(text: string, end: number): number {
  return end + 1 - Array.from(text).length;
}

function subpage(regionName: string, cities: readonly CityWeather[]): BuildResult {
  const b = createContentBuilder();
  b.heading(0, 1, regionName, YELLOW);
  b.text(1, 5, "City", CYAN);
  b.text(1, right("Temp", TEMP_END), "Temp", CYAN);
  b.text(1, right("Wind", WIND_END), "Wind", CYAN);
  const rows: string[][] = [];
  cities.forEach((weather, k) => {
    const name = cityName(weather.cityId);
    const kind = weatherKind(weather.weatherCode);
    const label = weatherLabel(kind);
    const temp = formatTemperature(weather.temperatureC);
    const wind = formatWind(weather.windKmh);
    const row = 2 + 3 * k;
    if (kind !== null) b.cells(row, 1, symbolCells(kind));
    b.text(row, 5, name, WHITE);
    b.text(row, right(temp, TEMP_END), temp, WHITE);
    b.text(row, right(wind, WIND_END), wind, WHITE);
    b.text(row + 1, 5, label, CYAN);
    rows.push([name, label, temp, wind]);
  });
  b.alt({ kind: "table", headers: ["City", "Weather", "Temp", "Wind"], rows });
  return b.build();
}

export function compile200(entry: SourceEntry<"open-meteo">): CompileResult {
  const built: BuildResult[] = [];
  for (const region of REGION_LIST) {
    const cities = region.cityIds.flatMap((id) => {
      const found = entry.value.cities.find((c) => c.cityId === id);
      return found === undefined ? [] : [found];
    });
    if (cities.length === 0) continue;
    built.push(subpage(region.name, cities));
  }
  if (built.length === 0) return noDataPage(200, "no-data");
  return finishPage(200, built, entryTime(entry.fetchedAt));
}
