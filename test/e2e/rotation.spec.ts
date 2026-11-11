import { expect, test } from "./guard.js";

// Subpage rotation, Hold and reduced motion (server-and-viewer 12.7), with a controlled clock.

test("201 rotates to 2/6 after 12 s without an announcement", async ({ page }) => {
  await page.clock.install();
  await page.goto("/201");
  await expect(page.locator(".si")).toHaveText("1/6");
  await page.clock.runFor(12_000);
  await expect(page.locator(".si")).toHaveText("2/6");
  await expect(page).toHaveURL(/\/201\?s=2$/);
  await expect(page.locator("#live")).toHaveText("");
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("#live")).toHaveText("Page 201, Five-day outlook, subpage 3 of 6");
});

test("Hold shows HOLD in row 1 and stops rotation until it is turned off", async ({ page }) => {
  await page.clock.install();
  await page.goto("/201");
  await page.keyboard.press("h");
  await expect(page.locator(".si")).toHaveText(" HOLD");
  await expect(page.getByRole("button", { name: "Hold" })).toHaveAttribute("aria-pressed", "true");
  await page.clock.runFor(36_000);
  await expect(page.locator(".si")).toHaveText(" HOLD");
  await expect(page).toHaveURL(/\/201$/);
  await page.keyboard.press("h");
  await expect(page.locator(".si")).toHaveText("1/6");
  await page.clock.runFor(12_000);
  await expect(page.locator(".si")).toHaveText("2/6");
});

test("with reduced motion there is no rotation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await page.goto("/201");
  await page.clock.runFor(36_000);
  await expect(page.locator(".si")).toHaveText("1/6");
  await expect(page).toHaveURL(/\/201$/);
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(".si")).toHaveText("2/6");
});

test("rotation waits while the text view is open", async ({ page }) => {
  await page.clock.install();
  await page.goto("/201");
  await page.keyboard.press("t");
  await page.clock.runFor(36_000);
  await expect(page.locator(".si")).toHaveText("1/6");
  await page.keyboard.press("t");
  await page.clock.runFor(12_000);
  await expect(page.locator(".si")).toHaveText("2/6");
});

test("the clock in row 0 ticks every second in the same format", async ({ page }) => {
  await page.clock.install();
  await page.goto("/100");
  const clock = page.locator(".ck");
  await expect(clock).toHaveText(/^[A-Z][a-z]{2} \d\d [A-Z][a-z]{2} \d\d:\d\d:\d\d$/);
  const first = await clock.textContent();
  await page.clock.runFor(3_000);
  await expect(clock).not.toHaveText(first ?? "");
});
