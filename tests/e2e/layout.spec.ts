/**
 * No page may be wider than a small phone in any language: long compound words
 * (German, Finnish, Danish, …) must wrap instead of widening the layout.
 */
import { readdirSync } from 'node:fs';
import { expect, locales, test } from './fixtures';

const pages = [
  '',
  ...readdirSync('dist/en', { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${entry.name}/`),
];

test.use({ viewport: { width: 320, height: 640 } });

for (const lang of locales) {
  test(`no page scrolls sideways at 320px: ${lang}`, async ({ page }) => {
    const tooWide: string[] = [];
    for (const path of pages) {
      await page.goto(`/${lang}/${path}`);
      const { scrollWidth, clientWidth } = await page.evaluate(() => {
        const { scrollWidth, clientWidth } = document.documentElement;
        return { scrollWidth, clientWidth };
      });
      if (scrollWidth > clientWidth) tooWide.push(`/${lang}/${path} (${scrollWidth}px)`);
    }
    expect(tooWide).toEqual([]);
  });
}
