/**
 * What the privacy policy promises, checked in a real browser:
 * no cookies, no third-party requests (both enforced by the fixtures for every
 * test), and nothing in the browser's storage besides the theme and, for the
 * thanks page, the signature code in this tab only.
 */
import { expect, fillForm, test, unique } from './fixtures';
import { columns } from './db';

test('a full visit leaves no cookies and only the expected storage', async ({ page }) => {
  for (const path of ['/en/', '/en/petition/', '/en/faq/', '/en/share/', '/en/privacy/']) await page.goto(path);
  await page.locator('[data-theme-toggle]').first().click();

  const { name, email } = unique('privacy');
  await page.goto('/en/');
  await fillForm(page, { name, email });
  await page.locator('[data-submit]').click();
  await page.waitForURL('**/en/thanks/');

  const storage = await page.evaluate(() => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
  }));
  expect(storage.local.every((k) => k === 'theme')).toBe(true);
  expect(storage.session).toEqual(['signature']);
});

test('the database has no column for IP addresses or browsers', () => {
  expect(columns().sort()).toEqual(
    ['country', 'created_at', 'delete_hash', 'email', 'email_hash', 'id', 'lang', 'name', 'verified', 'wants_updates'].sort(),
  );
});
