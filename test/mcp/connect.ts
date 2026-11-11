import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../../tools/mcp/create-server.js";

export interface Reply {
  readonly text: string;
  readonly isError: boolean;
}

export interface Connection {
  readonly client: Client;
  call(name: string, args: Record<string, unknown>): Promise<Reply>;
  close(): Promise<void>;
}

/** The text of the first content block of a tool result, and its `isError` flag. */
function replyOf(result: unknown): Reply {
  const content: unknown = (result as { content?: unknown }).content;
  const first: unknown = Array.isArray(content) ? content[0] : undefined;
  const text = (first as { text?: unknown } | undefined)?.text;
  const isError = (result as { isError?: unknown }).isError === true;
  return { text: typeof text === "string" ? text : "", isError };
}

/** The real server and a real SDK client, joined by the SDK's in-memory transport. */
export async function connect(): Promise<Connection> {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const server = createServer();
  const client = new Client({ name: "page100-test", version: "0.0.0" });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  return {
    client,
    call: async (name, args) => replyOf(await client.callTool({ name, arguments: args })),
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}
