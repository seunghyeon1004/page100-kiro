import { expect, test } from "./guard.js";

// Keyboard map of frontend.md, through the real script (server-and-viewer 12.3 to 12.6).

test("typing 2 0 0 shows partial entry, then loads page 200", async ({ page }) => {
  await page.goto("/100");
  const pn = page.locator(".pn");
  await expect(pn).toHaveText("P100");
  await page.keyboard.press("2");
  await expect(pn).toHaveText("P2--");
  await page.keyboard.press("0");
  await expect(pn).toHaveText("P20-");
  await page.keyboard.press("0");
  await expect(page).toHaveURL(/\/200$/);
  await expect(page.locator("h1")).toHaveText("200 World weather now");
  await expect(pn).toHaveText("P200");
  await expect(page).toHaveTitle("200 World weather now - Page 100");
});

test("Backspace removes the last digit and Escape cancels the entry", async ({ page }) => {
  await page.goto("/100");
  const pn = page.locator(".pn");
  await page.keyboard.press("3");
  await page.keyboard.press("0");
  await expect(pn).toHaveText("P30-");
  await page.keyboard.press("Backspace");
  await expect(pn).toHaveText("P3--");
  await page.keyboard.press("Escape");
  await expect(pn).toHaveText("P100");
  await expect(page).toHaveURL(/\/100$/);
});

test("Left and Right move to the previous and next in-service page", async ({ page }) => {
  await page.goto("/200");
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/201$/);
  await expect(page.locator("h1")).toHaveText("201 Five-day outlook");
  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL(/\/200$/);
  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL(/\/120$/);
});

test("Up and Down move between the subpages of 201 and wrap", async ({ page }) => {
  await page.goto("/201");
  const indicator = page.locator(".si");
  await expect(indicator).toHaveText("1/6");
  await page.keyboard.press("ArrowDown");
  await expect(page).toHaveURL(/\/201\?s=2$/);
  await expect(indicator).toHaveText("2/6");
  await page.keyboard.press("ArrowUp");
  await expect(page).toHaveURL(/\/201$/);
  await expect(indicator).toHaveText("1/6");
  await page.keyboard.press("ArrowUp");
  await expect(indicator).toHaveText("6/6");
});

test("Z X C V follow the four quick links and I goes to the index", async ({ page }) => {
  const targets: readonly (readonly [string, RegExp])[] = [
    ["z", /\/110$/],
    ["x", /\/200$/],
    ["c", /\/300$/],
    ["v", /\/800$/],
  ];
  for (const [key, url] of targets) {
    await page.goto("/100");
    await page.keyboard.press(key);
    await expect(page).toHaveURL(url);
  }
  await page.keyboard.press("I");
  await expect(page).toHaveURL(/\/100$/);
});

test("Back and Forward follow the history of swapped pages", async ({ page }) => {
  await page.goto("/100");
  for (const key of ["2", "0", "0"]) await page.keyboard.press(key);
  await expect(page).toHaveURL(/\/200$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/100$/);
  await expect(page.locator("h1")).toHaveText("100 Index");
  await page.goForward();
  await expect(page).toHaveURL(/\/200$/);
  await expect(page.locator("h1")).toHaveText("200 World weather now");
});

test("keys are ignored while the page-number field has focus", async ({ page }) => {
  await page.goto("/100");
  await page.locator("#p").focus();
  await page.keyboard.type("123");
  await expect(page.locator("#p")).toHaveValue("123");
  await expect(page).toHaveURL(/\/100$/);
  await expect(page.locator(".pn")).toHaveText("P100");
});
