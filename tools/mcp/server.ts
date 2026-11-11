import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./create-server.js";

// Dev-only stdio MCP server: `npx tsx tools/mcp/server.ts`. Stdout carries the protocol and
// nothing else; diagnostics go to stderr. Never imported by src/.

try {
  await createServer().connect(new StdioServerTransport());
  console.error("page100 MCP server ready");
} catch (error) {
  console.error(
    "page100 MCP server failed to start:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
}
