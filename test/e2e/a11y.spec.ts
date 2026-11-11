import { expect, test } from "./guard.js";

// Structure, names and focus (server-and-viewer 12.2, 13.3; frontend.md, "Text alternative",
// "Focus and announcements").

const PAGES = ["/100", "/201", "/550", "/899", "/123"];

for (const path of PAGES) {
  test(`${path} has one h1, a hidden screen and one polite live region`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator('.screen[aria-hidden="true"]')).toHaveCount(1);
    await expect(page.locator("[aria-live]")).toHaveCount(1);
    await expect(page.locator('[aria-live="polite"]')).toHaveCount(1);
    await expect(page.locator('[aria-live="assertive"]')).toHaveCount(0);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("[style]")).toHaveCount(0);
  });
}

test("every visible button and link has an accessible name", async ({ page }) => {
  await page.goto("/201");
  const controls = page.locator("#keypad button, .nav > *, .go button, .go input, .foot a");
  const count = await controls.count();
  expect(count).toBeGreaterThan(20);
  for (let i = 0; i < count; i++) {
    const control = controls.nth(i);
    if (await control.isVisible()) await expect(control).toHaveAccessibleName(/\S/);
  }
  await expect(page.locator("#q1")).toHaveAccessibleName("Red: Index");
});

test("Tab reaches every control with a solid outline of at least 3 px", async ({ page }) => {
  await page.goto("/201");
  const seen: string[] = [];
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press("Tab");
    const state = await page.evaluate<{ id: string; style: string; width: number } | null>(`(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const css = getComputedStyle(el);
      return {
        id: el.id || el.getAttribute("data-key") || el.tagName,
        style: css.outlineStyle,
        width: Number.parseFloat(css.outlineWidth),
      };
    })()`);
    if (state === null) {
      if (seen.length === 0) continue; // the first Tab can land on the browser itself
      break;
    }
    if (seen.includes(state.id)) break;
    seen.push(state.id);
    expect(state.style, `${state.id} outline style`).toBe("solid");
    expect(state.width, `${state.id} outline width`).toBeGreaterThanOrEqual(3);
  }
  for (const id of ["q1", "q4", "prev", "next", "sup", "sdown", "tv", "idx", "p", "about", "src"]) {
    expect(seen, id).toContain(id);
  }
  expect(seen).toContain("0");
  expect(seen).toContain("h");
  expect(seen).toContain("r");
});

test("page changes never move focus", async ({ page }) => {
  await page.goto("/201");
  await page.locator('[data-key="h"]').focus();
  await page.keyboard.press("ArrowDown");
  await expect(page).toHaveURL(/\/201\?s=2$/);
  expect(
    await page.evaluate<string | null | undefined>(
      'document.activeElement?.getAttribute("data-key")',
    ),
  ).toBe("h");
});

// Found by hand: the hidden text alternative's table was a 1 px scroll container, which Chromium
// makes a Tab stop, so the first Tab on any page with a table revealed the alternative and
// scrolled the screen away.
for (const path of ["/200", "/300", "/600"]) {
  test(`${path}: the first Tab stop is a control and the page does not scroll`, async ({
    page,
  }) => {
    await page.goto(path);
    await page.keyboard.press("Tab");
    const first = await page.evaluate<{ tag: string; inAlt: boolean; scrollY: number }>(`(() => {
      const el = document.activeElement;
      return { tag: el ? el.tagName : "", inAlt: !!(el && el.closest(".alt")), scrollY: window.scrollY };
    })()`);
    expect(first.tag).toBe("A");
    expect(first.inAlt).toBe(false);
    expect(first.scrollY).toBe(0);
  });
}
