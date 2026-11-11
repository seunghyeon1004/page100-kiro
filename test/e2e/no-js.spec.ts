import { expect, test } from "./guard.js";

// The baseline of frontend.md with JavaScript off (server-and-viewer 9, 13.1).

test.use({ javaScriptEnabled: false });

test("the form goes to /go and lands on /300", async ({ page }) => {
  await page.goto("/100");
  await page.locator("#p").fill("300");
  await page.getByRole("button", { name: "Go" }).click();
  await expect(page).toHaveURL(/\/300$/);
  await expect(page.locator("h1")).toHaveText("300 Exchange rates");
});

test("the four quick links are plain links", async ({ page }) => {
  await page.goto("/100");
  const targets = ["/110", "/200", "/300", "/800"];
  for (const [k, target] of targets.entries()) {
    await expect(page.locator(`#q${String(k + 1)}`)).toHaveAttribute("href", target);
  }
  await page.locator("#q2").click();
  await expect(page).toHaveURL(/\/200$/);
});

test("subpage and page links work on 201", async ({ page }) => {
  await page.goto("/201");
  await page.locator("#sdown").click();
  await expect(page).toHaveURL(/\/201\?s=2$/);
  await expect(page.locator("h1")).toHaveText("201 Five-day outlook");
  await page.locator("#sup").click();
  await expect(page).toHaveURL(/\/201$/);
  await page.locator("#next").click();
  await expect(page).toHaveURL(/\/300$/);
});

test("the checkbox reveals the concealed runs on 550", async ({ page }) => {
  await page.goto("/550");
  const concealed = page.locator(".screen .conceal").first();
  await expect(concealed).toHaveCSS("color", "rgba(0, 0, 0, 0)");
  await page.locator('label[for="reveal"]').click();
  await expect(concealed).not.toHaveCSS("color", "rgba(0, 0, 0, 0)");
});

test("the Text link opens /550.txt as plain text", async ({ page }) => {
  await page.goto("/550");
  await page.locator("#txt").click();
  await expect(page).toHaveURL(/\/550\.txt$/);
  const lines = (await page.locator("body").innerText()).split("\n");
  expect(lines.length).toBeGreaterThanOrEqual(24);
});

test("the keypad stays hidden and the script-only controls too", async ({ page }) => {
  await page.goto("/100");
  await expect(page.locator("#keypad")).toBeHidden();
  await expect(page.locator("#tv")).toBeHidden();
  await expect(page.locator("#txt")).toBeVisible();
  await expect(page.locator('label[for="reveal"]')).toBeVisible();
});
