/**
 * The signature counter refreshes once after load, then every minute, but only
 * while it is on screen and the tab is visible. The clock is faked, and
 * /api/count is answered by the test with a number that grows on every request.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const MINUTE = 60_000;

async function setUp(page: Page) {
  const calls = { count: 0 };
  await page.clock.install();
  await page.route('**/api/count', (route) => {
    calls.count++;
    return route.fulfill({ json: { count: 1000 * calls.count } });
  });
  await page.goto('/en/');
  const number = page.locator('[data-counter] [data-count]');
  await expect(number).toHaveText('1,000');
  // On a laptop-sized window the counter sits just below the fold.
  await number.scrollIntoViewIfNeeded();
  await observed(page);
  return { calls, number };
}

/** Resolves once pending IntersectionObserver callbacks (the counter's first) have run. */
const observed = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        new IntersectionObserver((_, observer) => {
          observer.disconnect();
          resolve();
        }).observe(document.querySelector('[data-counter]')!),
      ),
  );

/** Pretends the visitor switched to another tab (or back). */
const setHidden = (page: Page, hidden: boolean) =>
  page.evaluate((hidden) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);

test('the counter refreshes every minute while it is on screen', async ({ page }) => {
  const { calls, number } = await setUp(page);

  await page.clock.runFor(MINUTE);
  await expect(number).toHaveText('2,000');
  await page.clock.runFor(MINUTE);
  await expect(number).toHaveText('3,000');
  expect(calls.count).toBe(3);
});

test('the counter does not poll while scrolled out of view', async ({ page }) => {
  const { calls, number } = await setUp(page);

  await page.locator('footer').scrollIntoViewIfNeeded();
  await observed(page);
  await page.clock.runFor(5 * MINUTE);
  expect(calls.count).toBe(1);

  // Back on screen after more than a minute: refreshes at once.
  await number.scrollIntoViewIfNeeded();
  await observed(page);
  await page.clock.runFor(10);
  await expect(number).toHaveText('2,000');
});

test('the counter does not poll in a background tab', async ({ page }) => {
  const { calls, number } = await setUp(page);

  await setHidden(page, true);
  await page.clock.runFor(5 * MINUTE);
  expect(calls.count).toBe(1);

  await setHidden(page, false);
  await page.clock.runFor(10);
  await expect(number).toHaveText('2,000');
});
