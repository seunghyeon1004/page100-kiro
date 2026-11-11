import { expect, test as base } from "@playwright/test";

// Every browser test fails on a request to another origin, on a console error, on a page error,
// and on a `style` attribute left in the document (server-and-viewer 15.2, frontend.md).
// One narrow exception: Chromium logs "Failed to load resource ... 404" when the not-in-service
// screen of a page number (`/123`, `/123.frag`) is fetched or visited. Requirements 7.2 and 12.5
// make that 404 the designed answer, so that one message about such a URL is not an error.

export const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    const origin = new URL(baseURL ?? "http://127.0.0.1").origin;
    const foreign: string[] = [];
    const errors: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (url.startsWith("data:") || url.startsWith("about:") || url.startsWith("blob:")) return;
      if (new URL(url).origin !== origin) foreign.push(url);
    });
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const expected404 =
        message.text().includes("status of 404") &&
        /\/\d{3}(\.frag)?(\?|$)/.test(message.location().url);
      if (!expected404) errors.push(message.text());
    });
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    await use(page);

    // A plain-text document (`/550.txt`) is wrapped by Chromium in a `<pre style>` of its own.
    if (!page.isClosed()) {
      const styled = await page.evaluate<number>(
        "document.contentType === 'text/html' ? document.querySelectorAll('[style]').length : 0",
      );
      expect(styled, "elements with a style attribute").toBe(0);
    }
    expect(foreign, "requests to another origin").toEqual([]);
    expect(errors, "console and page errors").toEqual([]);
  },
});

export { expect };
