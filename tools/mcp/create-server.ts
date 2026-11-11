import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { COLOURS } from "../../src/grid/colours.js";
import { contrastReport } from "./contrast-report.js";
import { listPages } from "./list-pages.js";
import { previewMarkup } from "./preview-markup.js";
import { renderPage } from "./render-page.js";
import type { ToolReply } from "./tool-reply.js";
import { validateMarkup } from "./validate-markup.js";

/** Markup longer than this is refused: a full page is about 24 lines of 40 cells plus tags. */
const MAX_MARKUP_CHARS = 20_000;

const Markup = z.string().max(MAX_MARKUP_CHARS);
const PageNumber = z.number().int().min(100).max(899);
const ColourName = z.enum(COLOURS);

interface ToolResult {
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

function toResult(reply: ToolReply): ToolResult {
  return reply.isError
    ? { content: [{ type: "text", text: reply.text }], isError: true }
    : { content: [{ type: "text", text: reply.text }] };
}

/** Runs a tool body; an exception becomes an error result with its message, never a stack. */
function guarded(body: () => ToolReply | string): ToolResult {
  try {
    const reply = body();
    return toResult(typeof reply === "string" ? { text: reply, isError: false } : reply);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return toResult({ text: `tool failed: ${message}`, isError: true });
  }
}

/** The page100 dev server with its five tools. It reads only files of this repository. */
export function createServer(): McpServer {
  const server = new McpServer({ name: "page100", version: "0.1.0" });

  server.registerTool(
    "validate_markup",
    {
      description:
        "Parse and validate teletext markup. kind 'content' is the 1-20 lines of a pages/*.page file " +
        "(page rows 2-21); kind 'page' is a full 24-line page. Returns OK, or every violation with " +
        "row, column, code and message. Parse errors are reported before grid rules such as contrast.",
      inputSchema: { markup: Markup, kind: z.enum(["content", "page"]) },
    },
    ({ markup, kind }) => guarded(() => validateMarkup(markup, kind)),
  );

  server.registerTool(
    "preview_markup",
    {
      description:
        "Treat markup as the 20 content rows of an in-service page, frame it with the real frame " +
        "builder at the fixed time Wed 11 Nov 14:05:09 UTC, and return the 24x40 screen as text " +
        "(mosaics as Unicode), a second grid of foreground colour letters, and the text alternative. " +
        "Returns violations instead if the markup is invalid.",
      inputSchema: { markup: Markup, page: PageNumber },
    },
    ({ markup, page }) => guarded(() => previewMarkup(markup, page)),
  );

  server.registerTool(
    "render_page",
    {
      description:
        "Render an in-service page compiled from the boot snapshot and pages/*.page, in the same " +
        "three parts as preview_markup. subpage is 1-based and defaults to 1.",
      inputSchema: { page: PageNumber, subpage: z.number().int().min(1).max(9).optional() },
    },
    ({ page, subpage }) => guarded(() => renderPage(page, subpage)),
  );

  server.registerTool(
    "list_pages",
    {
      description: "List every in-service page: number, title, editor and subpage count.",
    },
    () => guarded(() => listPages()),
  );

  server.registerTool(
    "contrast",
    {
      description:
        "The WCAG contrast ratio of a foreground and background colour, and whether the grid " +
        "validator allows text in that pair (4.5:1 or more).",
      inputSchema: { fg: ColourName, bg: ColourName },
    },
    ({ fg, bg }) => guarded(() => contrastReport(fg, bg)),
  );

  return server;
}
