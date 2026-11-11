import { describe, expect, it } from "vitest";
import { createHttpClient } from "../../src/sources/http.js";
import { PACKAGE_VERSION, USER_AGENT, userAgent } from "../../src/sources/user-agent.js";
import { fakeDelay, sequenceFetch, textResponse } from "./fake-http.js";

// server-and-viewer 5.9

describe("userAgent", () => {
  it("is USER_AGENT while there is no public origin", () => {
    expect(userAgent(null)).toBe(USER_AGENT);
  });

  it("names the origin's page 801 otherwise", () => {
    expect(userAgent("https://page100.example.org")).toBe(
      `Page100/${PACKAGE_VERSION} (teletext revival, Kiroween 2026; +https://page100.example.org/801)`,
    );
  });
});

describe("createHttpClient userAgent", () => {
  it("sends the given User-Agent", async () => {
    const { fetch, calls } = sequenceFetch([() => Promise.resolve(textResponse(200, "{}"))]);
    const http = createHttpClient({ fetch, delay: fakeDelay([]).delay, userAgent: "T/1" });
    await http.getText("https://example.test/", { retry: false });
    expect(calls[0]?.init.headers).toEqual({ Accept: "application/json", "User-Agent": "T/1" });
  });
});
