import { describe, expect, it } from "vitest";
import { plainText } from "../../src/sources/plain-text.js";

describe("plainText (requirement 12.5)", () => {
  it("removes tags and comments", () => {
    expect(plainText('<!--Nov 8-->In <a href="./A" title="A">chess</a>, <b>X</b> wins.')).toBe(
      "In chess, X wins.",
    );
  });

  it("decodes the five named and numeric entities", () => {
    expect(
      plainText("a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#39; &#x27;f&#x27; &#x2F; &#039;"),
    ).toBe("a & b <c> \"d\" 'e' 'f' / '");
  });

  it("decodes in one pass, so &amp;lt; stays &lt;", () => {
    expect(plainText("&amp;lt; &amp;amp; &amp;#39;")).toBe("&lt; &amp; &#39;");
  });

  it("does not treat decoded angle brackets as tags", () => {
    expect(plainText("&lt;b&gt;bold&lt;/b&gt;")).toBe("<b>bold</b>");
  });

  it("collapses runs of whitespace and trims", () => {
    expect(plainText("  a \n\t b   <i></i>  c  ")).toBe("a b c");
  });

  it("keeps entities it does not know and invalid numeric references", () => {
    expect(plainText("&nbsp; &bogus; &#0; &#xD800; &#1114112; & alone")).toBe(
      "&nbsp; &bogus; &#0; &#xD800; &#1114112; & alone",
    );
  });

  it("returns an empty string for an empty or tag-only input", () => {
    expect(plainText("")).toBe("");
    expect(plainText("<p></p><!-- x -->")).toBe("");
  });

  it("does not remove or change non-ASCII text", () => {
    expect(plainText("<b>Kraków</b> – ok")).toBe("Kraków – ok");
  });
});
