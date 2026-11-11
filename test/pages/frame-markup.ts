import type { PageDef } from "../../src/pages/page-def.js";

// Canonical markup for rows 0, 1, 22 and 23, written by hand from design.md, "Frame rows". It does
// not use the frame builder, so the property tests compare two independent writings.

export interface FrameInput {
  readonly def: PageDef;
  readonly subpageIndex: number;
  readonly subpageCount: number;
  readonly now: Date;
  readonly stale: boolean;
  readonly lastGoodAt: Date | null;
}

/** `Ddd DD Mon HH:MM:SS` from `toUTCString()`, which reads `Wed, 11 Nov 2026 14:05:09 GMT`. */
function clock(now: Date): string {
  const parts = now.toUTCString().split(" ");
  const [weekday, day, month, , time] = parts;
  return `${(weekday ?? "").slice(0, 3)} ${day ?? ""} ${month ?? ""} ${time ?? ""}`;
}

function hhmm(date: Date): string {
  return `${date.toISOString().slice(11, 16)} UTC`;
}

const ATTRIBUTION_TEXT: Readonly<Record<string, string>> = {
  "wikimedia-feed": "Wikipedia, CC BY-SA 4.0",
  "wikimedia-onthisday": "Wikipedia, CC BY-SA 4.0",
  "open-meteo": "Weather: Open-Meteo, CC BY 4.0",
  frankfurter: "Rates: ECB via Frankfurter",
  "hacker-news": "Hacker News API",
  usgs: "USGS, public domain",
  "launch-library": "Launch Library 2",
  computed: "Computed by Page 100",
};

export function frameLines(input: FrameInput): [string, string, string, string] {
  const { def, subpageIndex, subpageCount, now, stale, lastGoodAt } = input;

  const row0 = `P${String(def.number)} {c}Page 100{w}${" ".repeat(8)}{y}${clock(now)}`;

  const indicator = subpageCount > 1 ? `${String(subpageIndex + 1)}/${String(subpageCount)}` : "";
  const gap = " ".repeat(40 - def.banner.length - indicator.length);
  const row1 = `{B}{y}${def.banner}{w}${gap}${indicator}`;

  let row22 = "";
  if (def.source !== "static") {
    if (stale) {
      row22 = `{y}Data delayed${lastGoodAt === null ? "" : `: last good ${hhmm(lastGoodAt)}`}`;
    } else {
      const attribution = ATTRIBUTION_TEXT[def.source] ?? "";
      row22 = `{c}${attribution}`;
      if (lastGoodAt !== null) {
        row22 += `{w}${" ".repeat(31 - attribution.length)}${hhmm(lastGoodAt)}`;
      }
    }
  }

  const tags = ["{R}{k}", "{G}", "{Y}", "{B}{w}"];
  const row23 = def.links
    .map((link, k) => `${tags[k] ?? ""} ${link.label}${" ".repeat(9 - link.label.length)}`)
    .join("");

  return [row0, row1, row22, row23];
}
