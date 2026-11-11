import { createServer } from "node:http";
import type { IncomingHttpHeaders, Server } from "node:http";
import type { Router, RouterRequest } from "./router.js";

// The socket (server-and-viewer 1.3, design.md, "Error handling"): the only file in `src` that
// imports `node:http`. It turns a request into a `RouterRequest` and a `RouterResponse` into bytes.

export interface RunningServer {
  /** The port actually bound (useful when 0 was asked for). */
  readonly port: number;
  /** Stops accepting connections, drops idle ones, and resolves when every open request is done. */
  close(): Promise<void>;
}

function headersOf(incoming: IncomingHttpHeaders): Record<string, string | undefined> {
  const headers: Record<string, string | undefined> = {};
  for (const [name, value] of Object.entries(incoming)) {
    headers[name] = Array.isArray(value) ? value.join(", ") : value;
  }
  return headers;
}

/** Listens on `host:port`; resolves once the socket is bound, rejects if it cannot be. */
export function startHttpServer(
  router: Router,
  port: number,
  host: string,
): Promise<RunningServer> {
  const server: Server = createServer((request, response) => {
    const routed: RouterRequest = {
      method: request.method ?? "GET",
      url: request.url ?? "/",
      headers: headersOf(request.headers),
    };
    try {
      const answer = router(routed);
      response.writeHead(answer.status, answer.headers);
      response.end(answer.body);
    } catch {
      response.writeHead(500, {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Length": "22",
      });
      response.end("Internal server error\n");
    }
  });
  server.on("clientError", (_error, socket) => {
    if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
    else socket.destroy();
  });
  // Longer than the idle timeout of the proxies in front of a typical host.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  return new Promise((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(port, host, () => {
      server.off("error", rejectPromise);
      const address = server.address();
      const bound = typeof address === "object" && address !== null ? address.port : port;
      resolvePromise({
        port: bound,
        close: () =>
          new Promise<void>((resolveClose) => {
            server.close(() => {
              resolveClose();
            });
            server.closeIdleConnections();
          }),
      });
    });
  });
}
