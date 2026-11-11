import { expect, test } from "./guard.js";

// Reveal and the in-page text view (server-and-viewer 12.9, 13.1).

const TRANSPARENT = "rgba(0, 0, 0, 0)";

test("on 550 concealed runs are transparent until R reveals them", async ({ page }) => {
  await page.goto("/550");
  const concealed = page.locator(".screen .conceal");
  await expect(concealed.first()).toHaveCSS("color", TRANSPARENT);
  const reveal = page.getByRole("button", { name: "Reveal" });
  await expect(reveal).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("r");
  await expect(concealed.first()).not.toHaveCSS("color", TRANSPARENT);
  await expect(reveal).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("r");
  await expect(concealed.first()).toHaveCSS("color", TRANSPARENT);
});

test("Reveal resets when the page changes", async ({ page }) => {
  await page.goto("/550");
  await page.keyboard.press("r");
  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL(/\/501$/);
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/550$/);
  await expect(page.locator(".screen .conceal").first()).toHaveCSS("color", TRANSPARENT);
});

test("T shows the same #alt element and hides the screen", async ({ page }) => {
  await page.goto("/550");
  const alt = page.locator("#alt");
  await page.evaluate("document.getElementById('alt').marker = 1");
  await page.keyboard.press("t");
  await expect(page.locator(".screen")).toBeHidden();
  await expect(alt).toBeVisible();
  await expect(page.locator("#tv")).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate<number>("document.getElementById('alt').marker")).toBe(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("550 Quiz of the day");
  await page.keyboard.press("t");
  await expect(page.locator(".screen")).toBeVisible();
  await expect(page.locator("#tv")).toHaveAttribute("aria-pressed", "false");
});

test("the text view stays open when the page changes", async ({ page }) => {
  await page.goto("/550");
  await page.keyboard.press("t");
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/600$/);
  await expect(page.locator(".screen")).toBeHidden();
  await expect(page.locator("#alt")).toBeVisible();
});
