/** Signing the petition with JavaScript: the normal path for nearly every visitor. */
import { CODE_RE, en, expect, fillForm, test, unique } from './fixtures';
import { counter, emailHash, signaturesByName } from './db';

test.describe('signing with JavaScript', () => {
  test('a verified signature is stored, counted and gets a withdrawal code @mobile', async ({ page }) => {
    const before = counter();
    const { name, email } = unique('sign');

    await page.goto('/en/');
    await fillForm(page, { name, email, country: 'DE' });
    await page.locator('[data-submit]').click();

    await page.waitForURL('**/en/thanks/');
    const code = (await page.locator('[data-code]').textContent())?.trim() ?? '';
    expect(code).toMatch(CODE_RE);
    await expect(page.locator('[data-code-box]')).toBeVisible();
    await expect(page.locator('[data-pending]')).toBeHidden();

    const rows = signaturesByName(name);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row).toMatchObject({ country: 'DE', lang: 'en', verified: 1, wants_updates: 0, email: null });
    expect(row.email_hash).toBe(emailHash(email));
    expect(row.delete_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.delete_hash).not.toContain(code.replaceAll('-', ''));
    expect(counter()).toBe(before + 1);

    // The code is kept only in this tab, for the thanks page.
    const stored = await page.evaluate(() => sessionStorage.getItem('signature'));
    expect(JSON.parse(stored!)).toEqual({ code, verified: true });
  });

  test('without e-mail, nothing about an address is stored', async ({ page }) => {
    const { name } = unique('no-email');
    await page.goto('/en/');
    await fillForm(page, { name, country: 'XX' });
    await page.locator('[data-submit]').click();
    await page.waitForURL('**/en/thanks/');

    const [row] = signaturesByName(name);
    expect(row).toMatchObject({ country: 'XX', email: null, email_hash: null, wants_updates: 0, verified: 1 });
  });

  test('with updates, the address is kept (trimmed and lower-cased)', async ({ page }) => {
    const { name, email } = unique('updates');
    await page.goto('/en/');
    await fillForm(page, { name, email: `  ${email.toUpperCase()} `, updates: true });
    await page.locator('[data-submit]').click();
    await page.waitForURL('**/en/thanks/');

    const [row] = signaturesByName(name);
    expect(row).toMatchObject({ email, wants_updates: 1, email_hash: emailHash(email) });
  });

  test('an address can sign only once, whatever its case', async ({ page }) => {
    const first = unique('dup');
    await page.goto('/en/');
    await fillForm(page, first);
    await page.locator('[data-submit]').click();
    await page.waitForURL('**/en/thanks/');
    const before = counter();

    await page.goto('/en/');
    await fillForm(page, { name: `${first.name} again`, email: first.email.toUpperCase() });
    await page.locator('[data-submit]').click();

    await expect(page.locator('[data-form-error]')).toHaveText(en.form.errors.duplicate);
    expect(signaturesByName(`${first.name} again`)).toHaveLength(0);
    expect(counter()).toBe(before);
    // The Turnstile token is single-use, so the widget is reset for the next try.
    expect(await page.evaluate(() => (window as any).__turnstileResets)).toBe(1);
  });

  test('a rejected Turnstile token is refused and nothing is stored', async ({ page }) => {
    const { name } = unique('captcha');
    await page.addInitScript(() => ((window as any).__TURNSTILE_TOKEN__ = 'forged'));
    await page.goto('/en/');
    await fillForm(page, { name });
    await page.locator('[data-submit]').click();

    await expect(page.locator('[data-form-error]')).toHaveText(en.form.errors.captcha_failed);
    expect(signaturesByName(name)).toHaveLength(0);
    await expect(page).toHaveURL(/\/en\/$/);
  });

  test('a bot filling the honeypot gets a fake success and nothing is stored', async ({ page }) => {
    const { name } = unique('honeypot');
    const before = counter();
    await page.goto('/en/');
    await fillForm(page, { name });
    await page.locator('input[name="website"]').fill('https://spam.example', { force: true });
    await page.locator('[data-submit]').click();

    await page.waitForURL('**/en/thanks/');
    expect(signaturesByName(name)).toHaveLength(0);
    expect(counter()).toBe(before);
  });

  test('the language of the page is stored with the signature', async ({ page }) => {
    const { name } = unique('lang');
    await page.goto('/fi/');
    await fillForm(page, { name, country: 'FI' });
    await page.locator('[data-submit]').click();
    await page.waitForURL('**/fi/thanks/');
    expect(signaturesByName(name)[0]).toMatchObject({ lang: 'fi', country: 'FI' });
  });
});

test.describe('form validation', () => {
  const cases = [
    { what: 'a missing name', input: { name: '' }, error: 'invalid_name', field: '#sig-name' },
    { what: 'a one-letter name', input: { name: 'A' }, error: 'invalid_name', field: '#sig-name' },
    { what: 'a missing country', input: { country: '' }, error: 'invalid_country', field: '#sig-country' },
    { what: 'an invalid e-mail', input: { email: 'not-an-address' }, error: 'invalid_email', field: '#sig-email' },
    { what: 'missing consent', input: { consent: false }, error: 'consent_required', field: 'input[name="consent"]' },
  ] as const;

  for (const c of cases) {
    test(`${c.what} is explained and the field is focused`, async ({ page }) => {
      await page.goto('/en/');
      await fillForm(page, { name: 'Valid Name', country: 'BE', ...c.input });
      await page.locator('[data-submit]').click();

      const error = page.locator('[data-form-error]');
      await expect(error).toBeVisible();
      await expect(error).toHaveText(en.form.errors[c.error]);
      await expect(error).toHaveAttribute('role', 'alert');
      const field = page.locator(c.field);
      await expect(field).toHaveAttribute('aria-invalid', 'true');
      await expect(field).toBeFocused();
      await expect(page).toHaveURL(/\/en\/$/);
    });
  }

  test('editing the field clears its error state', async ({ page }) => {
    await page.goto('/en/');
    await page.locator('[data-submit]').click();
    const name = page.locator('#sig-name');
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    await name.fill('Valid Name');
    await expect(name).not.toHaveAttribute('aria-invalid');
  });
});
