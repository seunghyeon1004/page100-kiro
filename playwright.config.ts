import { createServer } from "node:net";
import { defineConfig, devices } from "@playwright/test";

// Browser tests (server-and-viewer requirement 15.1): Chromium only, headless, against the built
// server on a free port with no refresh and no editor client. The first load of this file picks
// the port and stores it so every worker agrees; the owner installs the browser with
// `npx playwright install chromium`.

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      probe.close(() => {
        resolve(port);
      });
    });
  });
}

const port = Number(process.env.E2E_PORT ?? (await freePort()));
process.env.E2E_PORT = String(port);
const origin = `http://127.0.0.1:${String(port)}`;

export default defineConfig({
  testDir: "test/e2e",
  testMatch: "*.spec.ts",
  forbidOnly: true,
  retries: 0,
  reporter: "list",
  use: { baseURL: origin, headless: true },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], headless: true } }],
  webServer: {
    command: "tsc -p tsconfig.build.json && node dist/server/main.js",
    url: `${origin}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { PORT: String(port), REFRESH: "off", EDITOR_CLIENT: "off" },
  },
});
