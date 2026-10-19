/** The form must work without JavaScript: a plain HTML post, answered with an HTML page. */
import { CODE_RE, en, expect, fillForm, test, unique } from './fixtures';
import { counter, signaturesByName } from './db';

test.use({ javaScriptEnabled: false });

test('signing without JavaScript stores an unverified signature @mobile', async ({ page }) => {
  const before = counter();
  const { name, email } = unique('nojs');
  await page.goto('/de/');
  await fillForm(page, { name, email, country: 'AT' });
  await page.locator('[data-submit]').click();

  await page.waitForURL('**/api/sign');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  const code = (await page.locator('span.code').textContent())!.trim();
  expect(code).toMatch(CODE_RE);
  await expect(page.getByText(en.thanks.pending)).toBeVisible();

  expect(signaturesByName(name)[0]).toMatchObject({ verified: 0, lang: 'de', country: 'AT' });
  expect(counter()).toBe(before); // counted only after review

  // …and withdrawing without JavaScript.
  await page.goto('/de/delete/');
  await page.locator('#del-code').fill(code);
  await page.locator('[data-delete-form] button[type="submit"]').click();
  await page.waitForURL('**/api/delete');
  await expect(page.getByText(en.delete.success)).toBeVisible();
  expect(signaturesByName(name)).toHaveLength(0);
});

test('the browser enforces the required fields without JavaScript', async ({ page }) => {
  await page.goto('/en/');
  await page.locator('[data-submit]').click();
  await expect(page).toHaveURL(/\/en\/$/);
  expect(await page.locator('#sig-name').evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);
});

test('server-side errors are shown as a page', async ({ page }) => {
  await page.goto('/en/');
  await fillForm(page, { name: 'Valid Name', consent: false });
  // Bypass the browser's own check to reach the server.
  await page.locator('[data-signature-form]').evaluate((f: HTMLFormElement) => (f.noValidate = true));
  await page.locator('[data-submit]').click();
  await page.waitForURL('**/api/sign');
  await expect(page.getByText(en.form.errors.consent_required)).toBeVisible();
});
