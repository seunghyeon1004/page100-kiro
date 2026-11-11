import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { validateContentRows } from "../../src/grid/validate-content-rows.js";
import { parseContent } from "../../src/markup/parse-content.js";
import { serialiseContent } from "../../src/markup/serialise-content.js";
import { validContent } from "../grid/arbitraries.js";

describe("canonical content properties (Property 16)", () => {
  it("Property 16: parsing serialised content gives back the same content", () => {
    fc.assert(
      fc.property(validContent, (content) => {
        const parsed = parseContent(serialiseContent(content));
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.value).toEqual(content);
        expect(validateContentRows(parsed.value).ok).toBe(true);
      }),
    );
  });
});
