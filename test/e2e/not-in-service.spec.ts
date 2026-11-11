import { expect, test } from "./guard.js";

// A number with no page (server-and-viewer 7.2, 12.5).

test("typing 1 2 3 shows the not-in-service screen at /123 and leaves focus alone", async ({
  page,
}) => {
  await page.goto("/100");
  await page.locator("#q1").focus();
  for (const key of ["1", "2", "3"]) await page.keyboard.press(key);
  await expect(page).toHaveURL(/\/123$/);
  const screen = page.locator(".screen");
  await expect(screen).toContainText("120");
  await expect(screen).toContainText("200");
  expect(await page.evaluate<string | undefined>("document.activeElement?.id")).toBe("q1");
});

test("the same screen comes from a direct visit, with status 404", async ({ page }) => {
  const response = await page.goto("/123");
  expect(response?.status()).toBe(404);
  await expect(page.locator(".screen")).toContainText("120");
});
