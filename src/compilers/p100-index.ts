import { REGISTRY } from "../pages/registry.js";
import type { CellStyle } from "./cell-style.js";
import { canvasToCells } from "./mosaic-canvas.js";
import { blockText } from "./block-font.js";
import { WHITE, YELLOW, finishPage } from "./compile-helpers.js";
import type { CompileResult } from "./compile-types.js";
import { createContentBuilder } from "./content-builder.js";

// Page 100: the index (rule-compilers requirement 9.1, design.md, "Page layouts").

/** The 18 sections of the index, in two columns of nine, column by column. */
const SECTIONS: readonly (readonly [number, string])[] = [
  [110, "World news"],
  [120, "Most read"],
  [200, "Weather now"],
  [201, "Outlook"],
  [300, "Exchange rates"],
  [301, "Rate trend"],
  [400, "Developer news"],
  [500, "On this day"],
  [501, "Born and died"],
  [550, "Quiz"],
  [600, "Earthquakes"],
  [601, "The moon"],
  [610, "Launches"],
  [700, "Article"],
  [800, "Help"],
  [801, "About"],
  [802, "Status"],
  [899, "Test page"],
];

/** The page lists the registry and reads no source, so it takes no argument. */
export function compile100(): CompileResult {
  const b = createContentBuilder();
  b.alt({ kind: "paragraph", text: "Page 100" });
  const title = blockText("PAGE 100");
  if (title !== undefined) b.cells(1, 8, canvasToCells(title, YELLOW));

  const label: CellStyle = WHITE;
  SECTIONS.forEach(([number, name], i) => {
    const column = i < 9 ? 0 : 1;
    const row = 5 + (i % 9);
    const col = column === 0 ? 1 : 21;
    // Only sections that are in service are listed (the registry is the authority).
    if (!REGISTRY.some((def) => def.number === number)) return;
    b.link(
      row,
      col,
      [
        [String(number), YELLOW],
        [" ", label],
        [name, label],
      ],
      { page: number },
    );
  });
  b.lines(15, 1, ["Type a page number, or use the", "coloured links below."]);
  return finishPage(100, [b.build()], null);
}
