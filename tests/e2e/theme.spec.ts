/**
 * Light or dark: the visitor's own choice wins, otherwise the system setting, also
 * when it changes while the page is open, and also without JavaScript.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const DARK_BG = 'rgb(11, 20, 42)'; // navy-950
const LIGHT_BG = 'rgb(248, 246, 241)'; // paper

const background = (page: Page) => page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor);
const saved = (page: Page) => page.evaluate(() => localStorage.getItem('theme'));
const toggle = (page: Page) => page.locator('[data-theme-toggle]').first();

test('follows the system setting, also when it changes', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/en/');
  await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);

  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute('content', '#0b142a');
  expect(await saved(page)).toBeNull();
});

test('a choice made with the toggle wins over the system setting', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/en/');
  await toggle(page).click();
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute('content', '#0b142a');
  expect(await saved(page)).toBe('dark');

  // It is remembered, and a later system change does not override it.
  await page.goto('/en/petition/');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
});

test('switching back to the system setting forgets the choice', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/en/');
  await toggle(page).click();
  await toggle(page).click();
  await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
  expect(await saved(page)).toBeNull();

  // So the site follows the system again.
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
});

test('a choice made in another tab applies to open pages', async ({ context }) => {
  const [a, b] = [await context.newPage(), await context.newPage()];
  for (const p of [a, b]) {
    await p.emulateMedia({ colorScheme: 'light' });
    await p.goto('/en/');
  }
  await toggle(a).click();
  await expect(b.locator('html')).toHaveClass(/\bdark\b/);
  await expect(toggle(b)).toHaveAttribute('aria-pressed', 'true');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`follows a ${colorScheme} system setting`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto('/en/');
      expect(await background(page)).toBe(colorScheme === 'dark' ? DARK_BG : LIGHT_BG);
      await expect(toggle(page)).toBeHidden();
    });
  }
});
