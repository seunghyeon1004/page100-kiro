import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { REGISTRY } from "../../src/pages/registry.js";
import { connect, type Connection } from "./connect.js";

let conn: Connection;

beforeAll(async () => {
  conn = await connect();
});

afterAll(async () => {
  await conn.close();
});

/** The 24 lines of the screen section of a preview or render, row 0 first. */
function screenRows(text: string): string[] {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line.startsWith("-- screen"));
  return lines.slice(start + 1, start + 25);
}

/** The 24 lines of the colour section, row 0 first. */
function colourRows(text: string): string[] {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line.startsWith("-- foreground colour"));
  return lines.slice(start + 1, start + 25);
}

describe("the page100 MCP server", () => {
  it("lists exactly the five stable tool names", async () => {
    const { tools } = await conn.client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "contrast",
      "list_pages",
      "preview_markup",
      "render_page",
      "validate_markup",
    ]);
  });
});

describe("validate_markup", () => {
  it("accepts valid content markup", async () => {
    const reply = await conn.call("validate_markup", {
      markup: "{y}Hello\n{g}World",
      kind: "content",
    });
    expect(reply).toEqual({
      text: "OK: content markup, 20 rows (page rows 2-21) of 40 cells",
      isError: false,
    });
  });

  it("accepts a valid full page and reports a short page", async () => {
    const full = `${Array.from({ length: 24 }, () => "ok").join("\n")}\n`;
    expect((await conn.call("validate_markup", { markup: full, kind: "page" })).text).toBe(
      "OK: page markup, 24 rows of 40 cells",
    );
    const short = await conn.call("validate_markup", { markup: "ok\nok\n", kind: "page" });
    expect(short.text).toContain("INVALID: 1 violation");
    expect(short.text).toContain("row-count");
  });

  it("reports a row that is too long with its row, column and code", async () => {
    const reply = await conn.call("validate_markup", {
      markup: `ok\n${"x".repeat(41)}`,
      kind: "content",
    });
    expect(reply.isError).toBe(false);
    expect(reply.text).toMatch(/^INVALID: 1 violation\n/);
    expect(reply.text).toContain("row-too-long");
    expect(reply.text).toContain("row 3,");
  });

  it("reports a contrast violation at the cell, and every violation not just the first", async () => {
    const reply = await conn.call("validate_markup", {
      markup: "{R}{r}x\n{R}{r}y",
      kind: "content",
    });
    expect(reply.text).toMatch(/^INVALID: 2 violations\n/);
    expect(reply.text).toContain("row 2, col 0, contrast:");
    expect(reply.text).toContain("row 3, col 0, contrast:");
  });
});

describe("preview_markup", () => {
  it("frames the markup and shows text, colour letters and the text alternative", async () => {
    const reply = await conn.call("preview_markup", { markup: "{r}AB{g}C\n▌█", page: 899 });
    expect(reply.isError).toBe(false);
    const rows = screenRows(reply.text);
    expect(rows).toHaveLength(24);
    for (const row of rows) expect(Array.from(row)).toHaveLength(40);
    expect(rows[0]).toMatch(/^P899 Page 100 +Wed 11 Nov 14:05:09$/);
    expect(rows[2]?.startsWith("ABC")).toBe(true);
    expect(rows[3]?.startsWith("▌█")).toBe(true);
    const colours = colourRows(reply.text);
    expect(colours[2]).toBe(`rrg${"w".repeat(37)}`);
    expect(colours[3]).toBe("w".repeat(40));
    expect(reply.text).toContain("-- text alternative --");
    expect(reply.text).toContain("ABC");
  });

  it("is deterministic", async () => {
    const args = { markup: "{c}Same", page: 100 };
    expect((await conn.call("preview_markup", args)).text).toBe(
      (await conn.call("preview_markup", args)).text,
    );
  });

  it("returns the violations instead of a screen for invalid markup", async () => {
    const reply = await conn.call("preview_markup", { markup: "{R}{r}x", page: 899 });
    expect(reply.isError).toBe(false);
    expect(reply.text).toMatch(/^INVALID: 1 violation\n/);
    expect(reply.text).toContain("row 2, col 0, contrast:");
    expect(reply.text).not.toContain("-- screen");
  });

  it("refuses a page that is not in service", async () => {
    const reply = await conn.call("preview_markup", { markup: "x", page: 150 });
    expect(reply.isError).toBe(true);
    expect(reply.text).toContain("not in service");
  });
});

describe("render_page", () => {
  it("renders page 100 from the boot snapshot", async () => {
    const reply = await conn.call("render_page", { page: 100 });
    expect(reply.isError).toBe(false);
    expect(reply.text).toContain("PAGE 100 (Index), subpage 1 of 1");
    const rows = screenRows(reply.text);
    expect(rows).toHaveLength(24);
    expect(rows[0]?.startsWith("P100 Page 100")).toBe(true);
    expect(rows[1]?.startsWith("INDEX")).toBe(true);
  });

  it("renders a hand-written page from pages/", async () => {
    const reply = await conn.call("render_page", { page: 899 });
    expect(reply.isError).toBe(false);
    expect(screenRows(reply.text)[0]?.startsWith("P899")).toBe(true);
  });

  it("renders a later subpage", async () => {
    const reply = await conn.call("render_page", { page: 200, subpage: 2 });
    expect(reply.isError).toBe(false);
    expect(reply.text).toContain("subpage 2 of");
    expect(screenRows(reply.text)[1]).toMatch(/ 2\/\d$/);
  });

  it("reports a subpage that does not exist and a page that is not in service", async () => {
    const missing = await conn.call("render_page", { page: 100, subpage: 2 });
    expect(missing.isError).toBe(true);
    expect(missing.text).toContain("has 1 subpage; subpage 2 does not exist");
    const absent = await conn.call("render_page", { page: 150 });
    expect(absent.isError).toBe(true);
    expect(absent.text).toContain("not in service");
  });
});

describe("list_pages", () => {
  it("lists every registry page with title, editor and subpage count", async () => {
    const reply = await conn.call("list_pages", {});
    expect(reply.isError).toBe(false);
    const lines = reply.text.split("\n");
    expect(lines).toHaveLength(REGISTRY.length + 1);
    for (const def of REGISTRY) {
      const line = lines.find((l) => l.startsWith(`${String(def.number)} `));
      expect(line, `page ${String(def.number)}`).toBeDefined();
      expect(line).toContain(def.title);
      expect(line).toContain(def.editor);
      expect(line).toMatch(/\d$/);
    }
  });
});

describe("contrast", () => {
  it("allows white on black", async () => {
    const reply = await conn.call("contrast", { fg: "white", bg: "black" });
    expect(reply.text).toContain("white on black: 21.00:1");
    expect(reply.text).toContain("text allowed");
    expect(reply.text).not.toContain("NOT");
  });

  it("refuses white on red at 4.00:1", async () => {
    const reply = await conn.call("contrast", { fg: "white", bg: "red" });
    expect(reply.text).toContain("white on red: 4.00:1");
    expect(reply.text).toContain("text NOT allowed");
  });

  it("rejects a colour name that does not exist", async () => {
    const outcome = await conn.call("contrast", { fg: "orange", bg: "black" }).then(
      (reply) => reply.isError,
      () => true,
    );
    expect(outcome).toBe(true);
  });
});
