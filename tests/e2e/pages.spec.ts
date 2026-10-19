/** Every page in every language, plus checks on content that must never appear. */
import { expect, locales, test } from './fixtures';

const pages = ['', 'petition/', 'privacy/', 'legal/', 'faq/', 'share/', 'press/', 'thanks/', 'delete/'];

for (const lang of locales) {
  test(`all pages exist in ${lang}`, async ({ request }) => {
    for (const path of pages) {
      const res = await request.get(`/${lang}/${path}`);
      expect(res.status(), `/${lang}/${path}`).toBe(200);
      const html = await res.text();
      expect(html, `/${lang}/${path}`).toContain(`<html lang="${lang}"`);
      // Indexed pages list their language versions. Untranslated (fallback) and
      // noindex pages (thanks, delete) must not, or search engines index duplicates.
      // (Only languages marked complete are listed, so while only English is, there are none.)
      const alternates = html.match(/<link rel="alternate" hreflang="[^"]+"/g) ?? [];
      if (lang !== 'en' || ['thanks/', 'delete/'].includes(path)) expect(alternates, `/${lang}/${path}`).toEqual([]);
      if (alternates.length) expect(html, `/${lang}/${path}`).toContain('hreflang="x-default"');
      if (['thanks/', 'delete/'].includes(path)) expect(html).toContain('name="robots" content="noindex');
    }
  });
}

test('unknown pages return the 404 page', async ({ page }) => {
  const res = await page.goto('/en/does-not-exist/');
  expect(res?.status()).toBe(404);
  await expect(page.locator('h1')).toBeVisible();
});

test('the legal pages name no person, association or registration', async ({ request }) => {
  for (const lang of locales) {
    for (const path of ['legal/', 'privacy/']) {
      const html = await (await request.get(`/${lang}/${path}`)).text();
      const text = html.replace(/<[^>]+>/g, ' ');
      for (const banned of ['[Name', '[Address', 'Registration number', 'association', 'TODO']) {
        expect(text, `/${lang}/${path} contains "${banned}"`).not.toContain(banned);
      }
    }
  }
});

test('the thanks page without a signature shows no code', async ({ page }) => {
  await page.goto('/en/thanks/');
  await expect(page.locator('[data-code-box]')).toBeHidden();
});

test('the footer links to the public source code', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('footer').getByRole('link', { name: 'Source code' })).toHaveAttribute(
    'href',
    'https://github.com/Public-Order-EU/public-order.eu',
  );
});
