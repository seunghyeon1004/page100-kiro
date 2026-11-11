import { compileAll } from "../../src/compilers/compile-all.js";
import type { PageFiles } from "../../src/compilers/compile-types.js";
import { STATIC_PAGE_NUMBERS, staticPageNumber } from "../../src/compilers/static-page.js";
import { checkAltAgreement } from "../../src/pages/alt-agreement.js";
import { parseSnapshot } from "../../src/sources/snapshot.js";
import { CHECK_STATUS } from "./check-status.js";

// The checks of `npm run grid:check` (rule-compilers requirement 19), as a function of the text it
// reads, so that a test can run them on a broken file without touching the disk.

export interface PageFileInput {
  /** The file name inside `pages/`, for example `801.page`. */
  readonly name: string;
  readonly text: string;
}

export interface GridCheckReport {
  /** One line per problem, then the summary line. */
  readonly lines: string[];
  readonly pages: number;
  readonly screens: number;
  readonly problems: number;
}

function position(row: number | null, col: number | null): string {
  return `${row === null ? "" : ` row ${String(row)}`}${col === null ? "" : ` col ${String(col)}`}`;
}

/** Runs every check on the snapshot text and the files of `pages/`. Never throws. */
export function runGridCheck(
  snapshotText: string,
  files: readonly PageFileInput[],
): GridCheckReport {
  const problems: string[] = [];
  let pages = 0;
  let screens = 0;

  let json: unknown;
  try {
    json = JSON.parse(snapshotText);
  } catch {
    json = undefined;
  }
  const parsed = parseSnapshot(json);
  if (!parsed.ok) {
    problems.push(`snapshot.json: does not parse (${parsed.issuePaths.join(", ")})`);
    return finish(problems, pages, screens);
  }
  const snapshot = parsed.snapshot;

  const texts = new Map<number, string>();
  for (const file of files) {
    const number = staticPageNumber(file.name);
    if (number === undefined) {
      problems.push(`pages/${file.name}: not the file of a static page`);
    } else {
      texts.set(number, file.text);
    }
  }
  for (const number of STATIC_PAGE_NUMBERS) {
    if (!texts.has(number)) problems.push(`pages/${String(number)}.page: file is missing`);
  }

  const fetched = Object.values(snapshot.sources).map((entry) => Date.parse(entry.fetchedAt));
  const now = new Date(Math.max(...fetched));
  const pageFiles: PageFiles = {
    666: texts.get(666) ?? "",
    800: texts.get(800) ?? "",
    801: texts.get(801) ?? "",
    899: texts.get(899) ?? "",
  };
  const result = compileAll(snapshot, CHECK_STATUS(now), now, pageFiles);
  pages = result.outcomes.length;

  for (const outcome of result.outcomes) {
    if (outcome.outcome !== "failed") continue;
    const isFile = STATIC_PAGE_NUMBERS.includes(outcome.number);
    for (const problem of outcome.problems) {
      if (isFile && !texts.has(outcome.number)) continue;
      const where = position(problem.row, problem.col);
      if (isFile && (problem.code === "markup" || problem.code === "grid")) {
        problems.push(`pages/${String(outcome.number)}.page${where}: ${problem.message}`);
      } else {
        const sub = problem.subpage === null ? "" : ` subpage ${String(problem.subpage + 1)}`;
        problems.push(`page ${String(outcome.number)}${sub}${where}: ${problem.message}`);
      }
    }
  }

  for (const page of result.pages) {
    page.subpages.forEach((subpage, i) => {
      screens += 1;
      const agreement = checkAltAgreement(subpage.content, subpage.alt);
      if (!agreement.ok) {
        problems.push(
          `page ${String(page.number)} subpage ${String(i + 1)}: words not in the text alternative: ${agreement.missing.join(", ")}`,
        );
      }
    });
  }
  return finish(problems, pages, screens);
}

function finish(problems: string[], pages: number, screens: number): GridCheckReport {
  const summary = `${String(pages)} pages, ${String(screens)} screens, ${String(problems.length)} problems`;
  return { lines: [...problems, summary], pages, screens, problems: problems.length };
}

/** The process exit code for a report: 1 when there is any problem, else 0. */
export function exitCodeOf(report: GridCheckReport): 0 | 1 {
  return report.problems > 0 ? 1 : 0;
}
