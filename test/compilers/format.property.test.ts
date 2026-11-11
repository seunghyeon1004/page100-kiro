import fc from "fast-check";
import { describe, it } from "vitest";
import { expect } from "vitest";
import * as f from "../../src/compilers/format.js";

// Property 10 (design.md). The ranges and patterns below are written out here from the design
// table "Formatters", not read from the implementation.

const MON = "(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)";
const DAY = "(Sun|Mon|Tue|Wed|Thu|Fri|Sat)";

interface NumberRow {
  readonly name: string;
  readonly run: (x: number | null) => string;
  readonly min: number;
  readonly maxExclusive?: number;
  readonly max: number;
  readonly pattern: RegExp;
  readonly width: number;
}

const NUMBER_ROWS: readonly NumberRow[] = [
  {
    name: "temperature",
    run: f.formatTemperature,
    min: -100,
    max: 100,
    pattern: /^-?\d{1,3}°C$/,
    width: 6,
  },
  { name: "wind", run: f.formatWind, min: 0, max: 999, pattern: /^\d{1,3} km\/h$/, width: 8 },
  {
    name: "precipitation",
    run: f.formatPrecipitation,
    min: 0,
    max: 999,
    pattern: /^\d{1,3}\.\d mm$/,
    width: 8,
  },
  {
    name: "rate",
    run: f.formatRate,
    min: 0,
    max: 999_999.5,
    maxExclusive: 1,
    pattern: /^(\d\.\d{4}|\d{2,3}\.\d{2}|\d{1,3}(,\d{3})+)$/,
    width: 7,
  },
  {
    name: "change",
    run: f.formatChange,
    min: -999.99,
    max: 999.99,
    pattern: /^([+-]\d{1,3}\.\d{2}|0\.00)%$/,
    width: 8,
  },
  {
    name: "magnitude",
    run: f.formatMagnitude,
    min: -2,
    max: 10,
    pattern: /^M-?\d{1,2}\.\d$/,
    width: 5,
  },
  {
    name: "km",
    run: f.formatKm,
    min: -100,
    max: 1000,
    pattern: /^-?\d{1,3}(,\d{3})? km$/,
    width: 8,
  },
  { name: "percent", run: f.formatPercent, min: 0, max: 100, pattern: /^\d{1,3}%$/, width: 4 },
  {
    name: "integer",
    run: (x) => f.formatInteger(x, 99_999_999),
    min: 0,
    max: 99_999_999,
    pattern: /^\d{1,3}(,\d{3})*$/,
    width: 10,
  },
];

function inRange(row: NumberRow, x: number): boolean {
  return (
    x >= row.min &&
    (row.maxExclusive === 1 ? x < row.max : x <= row.max) &&
    !(row.name === "rate" && x <= 0)
  );
}

const doubles = fc.oneof(
  fc.double({ noNaN: false }),
  fc.constantFrom(-0, 0, Number.NaN, Infinity, -Infinity, 1e308, -1e308, 5e-324),
  fc.double({ min: -1100, max: 1100 }),
  fc.double({ min: -1, max: 1 }),
  fc.integer({ min: -1_000_100, max: 1_000_100 }),
);

describe("formatters", () => {
  const checks: (() => void)[] = [];
  for (const row of NUMBER_ROWS) {
    checks.push(() => {
      fc.assert(
        fc.property(fc.oneof(doubles, fc.constant(null)), (x) => {
          const out = row.run(x);
          expect(out.length).toBeLessThanOrEqual(row.width);
          const expectNa = x === null || !Number.isFinite(x) || !inRange(row, x);
          if (expectNa) expect(out).toBe("n/a");
          else {
            expect(out).not.toBe("n/a");
            expect(out).toMatch(row.pattern);
          }
        }),
      );
    });
  }

  checks.push(() => {
    fc.assert(
      fc.property(fc.anything(), (x) => {
        for (const row of NUMBER_ROWS) {
          const out = row.run(x as never);
          expect(typeof out).toBe("string");
          if (typeof x !== "number") expect(out).toBe("n/a");
        }
      }),
    );
  });

  const times = fc.oneof(
    fc.date({ min: new Date(0), max: new Date(Date.UTC(2300, 0, 1)), noInvalidDate: false }),
    fc
      .date({ min: new Date(0), max: new Date(Date.UTC(2300, 0, 1)), noInvalidDate: true })
      .map((d) => d.toISOString()),
    fc.string(),
    fc.constant(null),
  );

  checks.push(() => {
    const rows: readonly [(t: Date | string | null) => string, RegExp, number][] = [
      [f.formatTime, /^\d\d:\d\d$/, 5],
      [f.formatTimeUtc, /^\d\d:\d\d UTC$/, 9],
      [f.formatDate, new RegExp(`^${DAY} \\d\\d ${MON}$`), 10],
    ];
    fc.assert(
      fc.property(times, (t) => {
        const ms =
          t instanceof Date ? t.getTime() : typeof t === "string" ? Date.parse(t) : Number.NaN;
        const looksIso =
          t instanceof Date ||
          (typeof t === "string" && /^\d{4}-\d\d-\d\dT.*(Z|[+-]\d\d:\d\d)$/.test(t));
        const year = new Date(ms).getUTCFullYear();
        const valid = looksIso && Number.isFinite(ms) && year >= 1970 && year <= 2199;
        for (const [run, pattern, width] of rows) {
          const out = run(t);
          expect(out.length).toBeLessThanOrEqual(width);
          if (valid) expect(out).toMatch(pattern);
          else expect(out).toBe("n/a");
        }
      }),
    );
  });

  checks.push(() => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.integer({ min: -3, max: 15 }),
        fc.integer({ min: -3, max: 35 }),
        fc.integer({ min: -20_000, max: 20_000 }),
        (s, m, d, y) => {
          const cal = f.formatCalendarDate(s);
          const full = f.formatFullDate(s);
          expect(cal === "n/a" || new RegExp(`^${DAY} \\d\\d ${MON}$`).test(cal)).toBe(true);
          expect(full === "n/a" || new RegExp(`^\\d\\d ${MON} \\d{4}$`).test(full)).toBe(true);
          expect(cal.length).toBeLessThanOrEqual(10);
          expect(full.length).toBeLessThanOrEqual(11);
          const dm = f.formatDayMonth(m, d);
          const days = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
          const ok = m >= 1 && m <= 12 && days !== undefined && d >= 1 && d <= days;
          if (ok) expect(dm).toMatch(new RegExp(`^\\d\\d ${MON}$`));
          else expect(dm).toBe("n/a");
          const yr = f.formatYear(y);
          if (y === 0 || y < -9999 || y > 9999) expect(yr).toBe("n/a");
          else expect(yr).toMatch(/^\d{1,4}( BC)?$/);
          expect(yr.length).toBeLessThanOrEqual(7);
          expect(f.formatYear(y + 0.5)).toBe("n/a");
          expect(f.formatCalendarDate(null)).toBe("n/a");
        },
      ),
    );
  });

  checks.push(() => {
    fc.assert(
      fc.property(
        fc.date({
          min: new Date(Date.UTC(1960, 0, 1)),
          max: new Date(Date.UTC(2210, 0, 1)),
          noInvalidDate: true,
        }),
        (date) => {
          const ymd = date.toISOString().slice(0, 10);
          const year = date.getUTCFullYear();
          const out = f.formatCalendarDate(ymd);
          if (year >= 1970 && year <= 2199) expect(out).not.toBe("n/a");
          else expect(out).toBe("n/a");
        },
      ),
    );
  });

  it("Property 10: every formatter never throws, fits its width, prints n/a exactly when out of range and matches its pattern otherwise", () => {
    for (const check of checks) check();
  });
});
