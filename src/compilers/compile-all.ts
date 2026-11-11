import { toNonEmpty } from "../grid/non-empty.js";
import type { NonEmpty } from "../grid/types.js";
import { buildScreen } from "../pages/build-screen.js";
import { checkCompiledPage } from "../pages/check-compiled-page.js";
import type { CompiledProblem } from "../pages/check-compiled-page.js";
import type { CompiledPage } from "../pages/compiled-page.js";
import type { PageDef } from "../pages/page-def.js";
import { REGISTRY } from "../pages/registry.js";
import type { Snapshot } from "../sources/snapshot.js";
import type { CompileProblem, CompileResult, Outcome, PageFiles } from "./compile-types.js";
import { compile100 } from "./p100-index.js";
import { compile110 } from "./p110-news-index.js";
import { compileStory } from "./p111-news-story.js";
import { compile120 } from "./p120-most-read.js";
import { compile200 } from "./p200-weather-now.js";
import { compile201 } from "./p201-outlook.js";
import { compile300 } from "./p300-rates.js";
import { compile301 } from "./p301-rate-trend.js";
import { compileHn } from "./p400-developer-news.js";
import { compile500 } from "./p500-on-this-day.js";
import { compile501 } from "./p501-births-deaths.js";
import { compile550 } from "./p550-quiz.js";
import { compile600 } from "./p600-earthquakes.js";
import { compile601 } from "./p601-moon.js";
import { compile610 } from "./p610-launches.js";
import { compile700 } from "./p700-featured-article.js";
import { compile802 } from "./p802-service-status.js";
import type { ServiceStatus } from "./service-status.js";
import { compileStatic } from "./static-page.js";

// compileAll: every registry page, each compiled and checked on its own (rule-compilers
// requirement 18, design.md, "compileAll and grid:check").

export type PageOutcome =
  | { readonly number: number; readonly outcome: Outcome }
  | {
      readonly number: number;
      readonly outcome: "failed";
      readonly problems: NonEmpty<CompileProblem>;
    };

export interface CompileAllResult {
  /** The pages that compiled or have no data, in ascending number order. */
  readonly pages: readonly CompiledPage[];
  /** One outcome per registry page, in registry order. */
  readonly outcomes: readonly PageOutcome[];
}

type Compiler = () => CompileResult;

function compilerFor(
  number: number,
  snapshot: Snapshot,
  status: ServiceStatus,
  now: Date,
  pageFiles: PageFiles,
): Compiler | undefined {
  const feed = snapshot.sources["wikimedia-feed"];
  const day = snapshot.sources["wikimedia-onthisday"];
  const weather = snapshot.sources["open-meteo"];
  const rates = snapshot.sources.frankfurter;
  const news = snapshot.sources["hacker-news"];
  if (number >= 111 && number <= 118)
    return () => compileStory({ entry: feed, story: number - 110 });
  switch (number) {
    case 100:
      return () => compile100();
    case 110:
      return () => compile110(feed);
    case 120:
      return () => compile120(feed);
    case 200:
      return () => compile200(weather);
    case 201:
      return () => compile201(weather);
    case 300:
      return () => compile300(rates);
    case 301:
      return () => compile301(rates);
    case 400:
      return () => compileHn({ entry: news, list: "top" });
    case 401:
      return () => compileHn({ entry: news, list: "show" });
    case 402:
      return () => compileHn({ entry: news, list: "ask" });
    case 500:
      return () => compile500(day);
    case 501:
      return () => compile501(day);
    case 550:
      return () => compile550(day, now);
    case 600:
      return () => compile600(snapshot.sources.usgs);
    case 601:
      return () => compile601(now);
    case 610:
      return () => compile610(snapshot.sources["launch-library"]);
    case 700:
      return () => compile700(feed);
    case 802:
      return () => compile802(status, now);
    case 666:
    case 800:
    case 801:
    case 899:
      return () => compileStatic(number, pageFiles[number]);
    default:
      return undefined;
  }
}

function pageCheckProblem(problem: CompiledProblem): CompileProblem {
  const subpage = "subpage" in problem ? problem.subpage : null;
  const detail = "words" in problem ? `: ${problem.words.join(", ")}` : "";
  return {
    code: "page-check",
    subpage,
    row: null,
    col: null,
    message: `${problem.code}${detail}`,
  };
}

/** The problems `checkCompiledPage` and `buildScreen` (both `stale` values, every subpage) find; empty when the page is sound. */
export function problemsOf(def: PageDef, page: CompiledPage, now: Date): CompileProblem[] {
  const found: CompileProblem[] = checkCompiledPage(def, page).map(pageCheckProblem);
  page.subpages.forEach((_, subpage) => {
    for (const stale of [false, true]) {
      const screen = buildScreen(def, page, subpage, { now, stale, lastGoodAt: page.dataAt });
      if (screen.ok) continue;
      if (screen.error === "frame-invalid") {
        for (const v of screen.violations) {
          found.push({ code: "frame", subpage, row: v.row, col: v.col, message: v.message });
        }
      } else {
        found.push({ code: "frame", subpage, row: null, col: null, message: screen.error });
      }
    }
  });
  return found;
}

interface Compiled {
  readonly outcome: PageOutcome;
  readonly page?: CompiledPage;
}

function failed(number: number, problems: readonly CompileProblem[]): Compiled {
  const list = toNonEmpty([...problems]);
  const fallback: NonEmpty<CompileProblem> = [
    { code: "page-check", subpage: null, row: null, col: null, message: "page failed" },
  ];
  return { outcome: { number, outcome: "failed", problems: list ?? fallback } };
}

function threw(number: number, error: unknown): Compiled {
  const name = error instanceof Error ? error.name : "unknown";
  return failed(number, [
    { code: "threw", subpage: null, row: null, col: null, message: `compiler threw ${name}` },
  ]);
}

function compileOne(def: PageDef, compiler: Compiler | undefined, now: Date): Compiled {
  if (compiler === undefined) {
    return failed(def.number, [
      {
        code: "page-check",
        subpage: null,
        row: null,
        col: null,
        message: "no compiler for this page",
      },
    ]);
  }
  let result: CompileResult;
  try {
    result = compiler();
  } catch (error) {
    return threw(def.number, error);
  }
  if (!result.ok) return failed(def.number, result.problems);
  const problems = problemsOf(def, result.page, now);
  if (problems.length > 0) return failed(def.number, problems);
  return { outcome: { number: def.number, outcome: result.outcome }, page: result.page };
}

/**
 * Compiles every registry page. A page is left out of `pages` and reported `failed` when its
 * compiler fails or throws, `checkCompiledPage` reports a problem, or `buildScreen` fails for any
 * subpage with `stale` false or true. One page's failure changes no other page. Never throws.
 */
export function compileAll(
  snapshot: Snapshot,
  status: ServiceStatus,
  now: Date,
  pageFiles: PageFiles,
): CompileAllResult {
  const pages: CompiledPage[] = [];
  const outcomes: PageOutcome[] = [];
  for (const def of REGISTRY) {
    let one: Compiled;
    try {
      one = compileOne(def, compilerFor(def.number, snapshot, status, now, pageFiles), now);
    } catch (error) {
      // Only reached when choosing the compiler throws (a snapshot that is not an object, say);
      // this page is reported and the others go on.
      one = threw(def.number, error);
    }
    outcomes.push(one.outcome);
    if (one.page !== undefined) pages.push(one.page);
  }
  return { pages, outcomes };
}
