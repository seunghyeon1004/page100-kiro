import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CSP } from "../../src/server/headers.js";
import { createRouter } from "../../src/server/router.js";
import { NOW } from "../compilers/boot-snapshot.js";
import { storeOfBootPages, testAssets } from "./render-fixtures.js";
import { rawUrl, requestHeaders, requestMethod } from "./server-arbitraries.js";

// Property 5 (server-and-viewer design.md): the router never throws and every answer is well formed.

const router = createRouter({ store: storeOfBootPages(), assets: testAssets(), clock: () => NOW });
const STATUSES = new Set([200, 303, 304, 400, 404, 405, 503]);

describe("router properties", () => {
  it("Property 5: for all methods, URLs and headers the router does not throw, answers an allowed status, sends the security headers and a true Content-Length, and keeps HEAD bodiless", () => {
    fc.assert(
      fc.property(requestMethod, rawUrl, requestHeaders, (method, url, headers) => {
        const response = router({ method, url, headers });
        expect(STATUSES.has(response.status), `status ${String(response.status)}`).toBe(true);
        expect(response.headers["Content-Security-Policy"]).toBe(CSP);
        expect(response.headers["X-Content-Type-Options"]).toBe("nosniff");
        expect(response.headers["Referrer-Policy"]).toBe("no-referrer");
        expect(response.headers["Cross-Origin-Opener-Policy"]).toBe("same-origin");
        expect(response.headers["Set-Cookie"]).toBeUndefined();

        if (method !== "GET" && method !== "HEAD") {
          expect(response.status).toBe(405);
          expect(response.headers.Allow).toBe("GET, HEAD");
        }
        if (method === "HEAD") {
          expect(response.body).toHaveLength(0);
          const get = router({ method: "GET", url, headers });
          expect(response.headers["Content-Length"]).toBe(get.headers["Content-Length"]);
          expect(response.status).toBe(get.status);
        } else if (response.status === 304) {
          expect(response.headers["Content-Length"]).toBe("0");
          expect(response.body).toHaveLength(0);
        } else {
          expect(response.headers["Content-Length"]).toBe(String(response.body.byteLength));
        }
      }),
      { numRuns: 300 },
    );
  });
});
