/**
 * Without JavaScript: signing is impossible (it needs the Turnstile check), the
 * page says so, and withdrawing a signature still works as a plain HTML post.
 */
import { E2E } from './config.mjs';
import { de, escapeHtml, expect, test, unique } from './fixtures';
import { counter, signaturesByName } from './db';

test.use({ javaScriptEnabled: false });

test('the form is disabled and explains why @mobile', async ({ page }) => {
  await page.goto('/de/');
  await expect(page.getByText(de.form.noscript)).toBeVisible();
  await expect(page.locator('[data-fields]')).toHaveAttribute('disabled');
  await expect(page.locator('[data-submit]')).toBeDisabled();
  await expect(page.locator('#sig-name')).toBeDisabled();
});

test('a plain form post without the Turnstile check is refused as a page', async ({ request }) => {
  const before = counter();
  const { name } = unique('nojs');
  const res = await request.post('/api/sign', { form: { name, country: 'AT', consent: '1', lang: 'de' } });
  expect(res.status()).toBe(400);
  const html = await res.text();
  expect(html).toContain('<html lang="de"');
  expect(html).toContain(escapeHtml(de.form.errors.captcha_missing));
  expect(signaturesByName(name)).toHaveLength(0);
  expect(counter()).toBe(before);
});

test('withdrawing works without JavaScript @mobile', async ({ page, request }) => {
  const { name } = unique('nojs-withdraw');
  const form = { name, country: 'AT', consent: '1', lang: 'de', 'cf-turnstile-response': E2E.passToken };
  const signed = await request.post('/api/sign', { form, headers: { Accept: 'application/json' } });
  const { code } = await signed.json();
  const before = counter();

  await page.goto('/de/delete/');
  await page.locator('#del-code').fill(code);
  await page.locator('[data-delete-form] button[type="submit"]').click();
  await page.waitForURL('**/api/delete');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.getByText(de.delete.success)).toBeVisible();
  expect(signaturesByName(name)).toHaveLength(0);
  expect(counter()).toBe(before - 1);
});
