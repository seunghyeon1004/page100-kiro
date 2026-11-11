import type { Page } from "@playwright/test";
import { expect, test } from "./guard.js";

// Phone layout and touch targets (server-and-viewer 12.2, 13.2, 13.3).

const CONTROLS = "#keypad button, .nav > *, .go button, .go input, .foot a";

interface Box {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

async function visibleControls(page: Page): Promise<Box[]> {
  return page.evaluate<Box[]>(`(() =>
    [...document.querySelectorAll(${JSON.stringify(CONTROLS)})]
      .filter((el) => el.getClientRects().length > 0)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          name: el.id || el.getAttribute("data-key") || el.textContent.trim(),
          x: r.x,
          y: r.y,
          w: r.width,
          h: r.height,
        };
      }))()`);
}

test.describe("390 x 844 with touch", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("the keypad is visible and every target is 44 px with 8 px between", async ({ page }) => {
    await page.goto("/201");
    await expect(page.locator("#keypad")).toBeVisible();
    const boxes = await visibleControls(page);
    expect(boxes.length).toBeGreaterThan(20);
    for (const box of boxes) {
      expect(box.w, `${box.name} width`).toBeGreaterThanOrEqual(44);
      expect(box.h, `${box.name} height`).toBeGreaterThanOrEqual(44);
    }
    for (const [i, a] of boxes.entries()) {
      for (const b of boxes.slice(i + 1)) {
        const gapX = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w));
        const gapY = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h));
        expect(Math.max(gapX, gapY), `${a.name} and ${b.name}`).toBeGreaterThanOrEqual(7.99);
      }
    }
  });

  test("tapping 6 0 0 opens /600 and focus stays on the 0 button", async ({ page }) => {
    await page.goto("/100");
    await page.locator('[data-key="6"]').tap();
    await page.locator('[data-key="0"]').tap();
    await expect(page.locator(".pn")).toHaveText("P60-");
    await page.locator('[data-key="0"]').tap();
    await expect(page).toHaveURL(/\/600$/);
    await expect(page.locator("h1")).toHaveText("600 Earthquakes");
    const focused = await page.evaluate<string | null | undefined>(
      'document.activeElement?.getAttribute("data-key")',
    );
    expect(focused).toBe("0");
  });

  test("the screen fills the width", async ({ page }) => {
    await page.goto("/100");
    const box = await page.locator(".screen").boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(300);
    expect(box?.width ?? 0).toBeLessThanOrEqual(390);
    expect((box?.height ?? 0) / (box?.width ?? 1)).toBeCloseTo(0.8, 2);
  });
});

test.describe("320 x 640", () => {
  test.use({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true });

  for (const path of ["/100", "/201", "/300", "/550", "/899", "/123"]) {
    test(`${path} does not scroll sideways`, async ({ page }) => {
      await page.goto(path);
      expect(
        await page.evaluate<number>("document.documentElement.scrollWidth"),
      ).toBeLessThanOrEqual(320);
      await page.keyboard.press("t");
      expect(
        await page.evaluate<number>("document.documentElement.scrollWidth"),
      ).toBeLessThanOrEqual(320);
    });
  }
});
