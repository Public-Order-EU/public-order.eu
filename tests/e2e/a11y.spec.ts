/**
 * Automated accessibility scan (axe-core, WCAG 2.2 A/AA) of every page type,
 * in light and dark mode. Automated checks catch roughly a third of real issues
 * (contrast, names, landmarks, ARIA misuse); keyboard and screen-reader testing
 * by hand is still needed before launch.
 */
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const pages = ['', 'petition/', 'faq/', 'share/', 'press/', 'thanks/', 'delete/', 'privacy/', 'legal/', 'does-not-exist/'];

async function scan(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  // A readable summary on failure: rule, impact and the offending elements.
  const summary = violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  expect(summary).toEqual([]);
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} mode`, () => {
    test.use({ colorScheme });

    for (const path of pages) {
      test(`/en/${path} has no detectable accessibility issues`, async ({ page }) => {
        await page.goto(`/en/${path}`);
        await expect(page.locator('html')).toHaveClass(colorScheme === 'dark' ? /\bdark\b/ : /^(?!.*\bdark\b)/);
        await scan(page);
      });
    }

    test('the form in its error state has no detectable accessibility issues', async ({ page }) => {
      await page.goto('/en/');
      await page.locator('[data-submit]').click();
      await expect(page.locator('#sig-name')).toHaveAttribute('aria-invalid', 'true');
      await scan(page);
    });

    test('a translated page has no detectable accessibility issues', async ({ page }) => {
      await page.goto('/de/');
      await scan(page);
    });
  });
}
