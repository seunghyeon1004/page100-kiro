import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { COLOURS, COLOUR_LETTER, COLOUR_RGB } from "../../src/grid/colours.js";
import { FONT_PLACEHOLDER } from "../../src/server/assets.js";

// server-and-viewer 13.1 to 13.4 and the viewer notes of frontend.md, read from the stylesheet text.

const css = readFileSync(resolve(import.meta.dirname, "..", "..", "public/app.css"), "utf8");

function hex(rgb: readonly [number, number, number]): string {
  return `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

describe("public/app.css (13.1)", () => {
  it.each(COLOURS)("defines %s as the exact grid-rules value", (colour) => {
    const letter = COLOUR_LETTER[colour];
    expect(css).toContain(`--${letter}: ${hex(COLOUR_RGB[colour])};`);
  });

  it.each(COLOURS)("has a foreground and a background class for %s", (colour) => {
    const letter = COLOUR_LETTER[colour];
    expect(css).toMatch(new RegExp(`\\.f${letter} \\{\\s*--fg: var\\(--${letter}\\);\\s*\\}`));
    expect(css).toMatch(
      new RegExp(`\\.b${letter} \\{\\s*background: var\\(--${letter}\\);\\s*\\}`),
    );
  });

  it("hides concealed runs until the checkbox is checked", () => {
    expect(css).toMatch(/\.screen \.conceal \{\s*color: transparent;/);
    expect(css).toMatch(/#reveal:checked ~ \.view \.conceal \{\s*color: var\(--fg, var\(--w\)\);/);
  });

  it("holds no motion and no flash", () => {
    expect(css).not.toMatch(/transition|animation|@keyframes|blink/);
    expect(css).not.toMatch(/scroll-behavior\s*:\s*smooth/);
  });

  it("names the font by the placeholder URL that buildAssets rewrites", () => {
    expect(css).toContain(`url(${FONT_PLACEHOLDER})`);
    expect(css.match(/url\(/g)).toHaveLength(1);
  });
});

describe("public/app.css (13.2 to 13.4)", () => {
  it("makes the screen 30em wide with line-height 1 in Bedstead", () => {
    expect(css).toMatch(/\.screen \{\s*width: 30em;\s*font:\s*1em\/1 Bedstead,\s*monospace;/);
    expect(css).toMatch(/\.r \{\s*display: flex;\s*height: 1em;/);
  });

  it("sizes the font from container units, whole pixels, and 4 px steps from 480 px", () => {
    expect(css).toContain("container-type: inline-size;");
    expect(css).toContain("100cqw");
    expect(css).toContain("round(down, var(--fs), 1px)");
    expect(css).toContain("@media (min-width: 480px)");
    expect(css).toContain("round(down, var(--fs), 4px)");
  });

  it("puts the keypad beside the screen only when the window is wide", () => {
    expect(css).toContain("@media (min-width: 62rem) and (min-aspect-ratio: 4/3)");
    expect(css).toContain("grid-template-columns: auto 18rem;");
  });

  it("has a 3 px focus outline and never removes outlines", () => {
    expect(css).toMatch(/:focus-visible \{\s*outline: 3px solid #ffff00;/);
    expect(css).not.toMatch(/outline:\s*(none|0)\b/);
  });

  it("gives controls a 44 px target with an 8 px gap", () => {
    expect(css).toContain("min-width: 44px;");
    expect(css).toContain("min-height: 44px;");
    expect(css).toMatch(/\.keypad \{[^}]*gap: 8px/s);
    expect(css).toMatch(/\.nav,\s*\.keypad \{\s*display: grid;\s*gap: 8px;/);
  });

  it("keeps the screen colours and uses system colours for controls when colours are forced", () => {
    expect(css).toMatch(
      /@media \(forced-colors: active\) \{\s*\.screen \{\s*forced-color-adjust: none;/,
    );
    expect(css).toContain("ButtonText");
  });

  it("prints only the text alternative", () => {
    expect(css).toMatch(/@media print \{[\s\S]*\.screen,\s*#live \{\s*display: none;/);
  });

  it("stays inside the 6 KiB budget with room for no more than itself", () => {
    expect(Buffer.byteLength(css)).toBeLessThanOrEqual(6 * 1024);
  });
});
