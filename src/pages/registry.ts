import type { EditorKind, PageDef, PageSource, QuickLink } from "./page-def.js";

type LinkSpec = readonly [label: string, target: number];

function link([label, target]: LinkSpec): QuickLink {
  return Object.freeze({ label, target });
}

function def(
  number: number,
  title: string,
  banner: string,
  source: PageSource,
  editor: EditorKind,
  links: readonly [LinkSpec, LinkSpec, LinkSpec, LinkSpec],
): PageDef {
  const frozenLinks: PageDef["links"] = Object.freeze([
    link(links[0]),
    link(links[1]),
    link(links[2]),
    link(links[3]),
  ]);
  return Object.freeze({ number, title, banner, source, editor, links: frozenLinks });
}

/** Pages 111 to 118 share one row of the design table; `n` is the number minus 110. */
function newsStory(number: number): PageDef {
  return def(number, `News story ${String(number - 110)}`, "WORLD NEWS", "wikimedia-feed", "ai", [
    ["Index", 100],
    ["News", 110],
    ["Popular", 120],
    ["Weather", 200],
  ]);
}

/**
 * Every in-service page, in ascending order (requirement 2.1; table in design.md, "Registry").
 * Frozen at every level.
 */
export const REGISTRY: readonly PageDef[] = Object.freeze([
  def(100, "Index", "INDEX", "static", "rules", [
    ["News", 110],
    ["Weather", 200],
    ["Rates", 300],
    ["Help", 800],
  ]),
  def(110, "World news", "WORLD NEWS", "wikimedia-feed", "ai", [
    ["Index", 100],
    ["Story", 111],
    ["Popular", 120],
    ["Weather", 200],
  ]),
  newsStory(111),
  newsStory(112),
  newsStory(113),
  newsStory(114),
  newsStory(115),
  newsStory(116),
  newsStory(117),
  newsStory(118),
  def(120, "Most read on Wikipedia", "MOST READ ON WIKIPEDIA", "wikimedia-feed", "rules", [
    ["Index", 100],
    ["News", 110],
    ["Article", 700],
    ["Weather", 200],
  ]),
  def(200, "World weather now", "WORLD WEATHER NOW", "open-meteo", "rules", [
    ["Index", 100],
    ["Outlook", 201],
    ["News", 110],
    ["Rates", 300],
  ]),
  def(201, "Five-day outlook", "FIVE-DAY OUTLOOK", "open-meteo", "rules", [
    ["Index", 100],
    ["Now", 200],
    ["News", 110],
    ["Rates", 300],
  ]),
  def(300, "Exchange rates", "EXCHANGE RATES", "frankfurter", "rules", [
    ["Index", 100],
    ["Trend", 301],
    ["Weather", 200],
    ["Tech", 400],
  ]),
  def(301, "Exchange rate trend", "30-DAY RATE TREND", "frankfurter", "rules", [
    ["Index", 100],
    ["Rates", 300],
    ["Weather", 200],
    ["Tech", 400],
  ]),
  def(400, "Developer news", "DEVELOPER NEWS: TOP", "hacker-news", "rules", [
    ["Index", 100],
    ["Show", 401],
    ["Ask", 402],
    ["This day", 500],
  ]),
  def(401, "Developer news: Show", "DEVELOPER NEWS: SHOW", "hacker-news", "rules", [
    ["Index", 100],
    ["Top", 400],
    ["Ask", 402],
    ["This day", 500],
  ]),
  def(402, "Developer news: Ask", "DEVELOPER NEWS: ASK", "hacker-news", "rules", [
    ["Index", 100],
    ["Top", 400],
    ["Show", 401],
    ["This day", 500],
  ]),
  def(500, "On this day", "ON THIS DAY", "wikimedia-onthisday", "ai", [
    ["Index", 100],
    ["Births", 501],
    ["Quiz", 550],
    ["Quakes", 600],
  ]),
  def(501, "Births and deaths", "ON THIS DAY: BIRTHS AND DEATHS", "wikimedia-onthisday", "ai", [
    ["Index", 100],
    ["Events", 500],
    ["Quiz", 550],
    ["Quakes", 600],
  ]),
  def(550, "Quiz of the day", "QUIZ OF THE DAY", "wikimedia-onthisday", "rules", [
    ["Index", 100],
    ["Events", 500],
    ["Births", 501],
    ["Quakes", 600],
  ]),
  def(600, "Earthquakes", "EARTHQUAKES M4.5+, LAST 24 HOURS", "usgs", "rules", [
    ["Index", 100],
    ["Moon", 601],
    ["Launches", 610],
    ["Article", 700],
  ]),
  def(601, "The moon tonight", "THE MOON TONIGHT", "computed", "rules", [
    ["Index", 100],
    ["Quakes", 600],
    ["Launches", 610],
    ["Article", 700],
  ]),
  def(610, "Rocket launches", "UPCOMING ROCKET LAUNCHES", "launch-library", "rules", [
    ["Index", 100],
    ["Quakes", 600],
    ["Moon", 601],
    ["Article", 700],
  ]),
  def(666, "Back from the dead", "RESURRECTION", "static", "static", [
    ["Index", 100],
    ["News", 110],
    ["Moon", 601],
    ["Help", 800],
  ]),
  def(700, "Featured article", "FEATURED ARTICLE", "wikimedia-feed", "ai", [
    ["Index", 100],
    ["News", 110],
    ["Popular", 120],
    ["Help", 800],
  ]),
  def(800, "How to use Page 100", "HOW TO USE PAGE 100", "static", "static", [
    ["Index", 100],
    ["About", 801],
    ["Status", 802],
    ["Test", 899],
  ]),
  def(801, "About and sources", "ABOUT, SOURCES AND LICENCES", "static", "static", [
    ["Index", 100],
    ["Help", 800],
    ["Status", 802],
    ["Test", 899],
  ]),
  def(802, "Service status", "SERVICE STATUS", "computed", "rules", [
    ["Index", 100],
    ["Help", 800],
    ["About", 801],
    ["Test", 899],
  ]),
  def(899, "Engineering test page", "ENGINEERING TEST PAGE", "static", "static", [
    ["Index", 100],
    ["Help", 800],
    ["About", 801],
    ["Status", 802],
  ]),
]);

const BY_NUMBER: ReadonlyMap<number, PageDef> = new Map(REGISTRY.map((d) => [d.number, d]));

/** The registry entry whose number is `n`, or `undefined` for any other number, including `NaN` (requirement 2.6). */
export function findPage(n: number): PageDef | undefined {
  return BY_NUMBER.get(n);
}
