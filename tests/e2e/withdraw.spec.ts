/** Withdrawing a signature with its code (GDPR: right to erasure). */
import { en, expect, fillForm, test, unique } from './fixtures';
import { counter, signaturesByName } from './db';

async function sign(page: import('@playwright/test').Page, name: string) {
  await page.goto('/en/');
  await fillForm(page, { name });
  await page.locator('[data-submit]').click();
  await page.waitForURL('**/en/thanks/');
  return (await page.locator('[data-code]').textContent())!.trim();
}

test('a signature can be withdrawn with its code, typed loosely', async ({ page }) => {
  const { name } = unique('withdraw');
  const code = await sign(page, name);
  const before = counter();

  await page.locator(`a[href="/en/delete/"]`).first().click();
  await page.waitForURL('**/en/delete/');
  // Lower case, spaces instead of dashes: still accepted.
  await page.locator('#del-code').fill(` ${code.toLowerCase().replaceAll('-', ' ')} `);
  await page.locator('[data-delete-form] button[type="submit"]').click();

  const result = page.locator('[data-result]');
  await expect(result).toHaveText(en.delete.success);
  await expect(result).toHaveAttribute('role', 'status');
  expect(signaturesByName(name)).toHaveLength(0);
  expect(counter()).toBe(before - 1);
  expect(await page.evaluate(() => sessionStorage.getItem('signature'))).toBeNull();

  // The same code a second time: nothing left to delete, and the counter stays put.
  await page.locator('#del-code').fill(code);
  await page.locator('[data-delete-form] button[type="submit"]').click();
  await expect(result).toHaveText(en.delete.notFound);
  expect(counter()).toBe(before - 1);
});

test('a malformed code is rejected', async ({ page }) => {
  await page.goto('/en/delete/');
  await page.locator('#del-code').fill('ABCD-EFGH');
  await page.locator('[data-delete-form] button[type="submit"]').click();
  await expect(page.locator('[data-result]')).toHaveText(en.delete.invalid);
});
