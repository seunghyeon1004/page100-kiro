import { describe, expect, it } from "vitest";
import type { ContentRows, Grid, ValidContent, ValidPage } from "../../src/grid/types.js";

// Compile-time checks for requirement 2.4 of grid-core. Each expect-error directive below must
// produce an error, or `npm run typecheck` fails with an unused-directive error. The function is never called
// at run time: the sinks only exist so the assignments have a type to fail against.

const acceptPage = (page: ValidPage): number => page.length;
const acceptContent = (content: ValidContent): number => content.length;

/** Assignments that must fail to compile, plus one that must compile. */
export function brandChecks(
  grid: Grid,
  content: ContentRows,
  page: ValidPage,
  valid: ValidContent,
): number {
  let total = 0;
  // @ts-expect-error grid-core 2.4: a plain Grid is not a ValidPage
  total += acceptPage(grid);
  // @ts-expect-error grid-core 2.4: a plain ContentRows is not a ValidPage
  total += acceptPage(content);
  // @ts-expect-error grid-core 2.4: a plain Grid is not a ValidContent
  total += acceptContent(grid);
  // @ts-expect-error grid-core 2.4: a plain ContentRows is not a ValidContent
  total += acceptContent(content);
  // @ts-expect-error grid-core 2.4: a ValidPage is not a ValidContent
  total += acceptContent(page);
  // @ts-expect-error grid-core 2.4: a ValidContent is not a ValidPage
  total += acceptPage(valid);
  total += acceptPage(page);
  total += acceptContent(valid);
  return total;
}

describe("branded types (requirement 2.4)", () => {
  it("is checked at compile time by the expect-error lines above", () => {
    expect(typeof brandChecks).toBe("function");
  });
});
