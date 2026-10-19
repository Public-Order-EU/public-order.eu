/**
 * Shared test setup.
 *
 * - The Turnstile script is replaced by a stub that fills in the token
 *   (window.__TURNSTILE_TOKEN__, "test-pass" by default — the mock siteverify accepts only that).
 * - Every request to another origin is blocked and fails the test: the site must
 *   not load anything from third parties except Turnstile (privacy policy, CSP).
 * - Any Set-Cookie header fails the test: the privacy policy promises no cookies.
 */
import { readFileSync } from 'node:fs';
import { test as base, expect } from '@playwright/test';
import { E2E } from './config.mjs';

export const en = JSON.parse(readFileSync('src/i18n/ui/en.json', 'utf8'));
export const de = JSON.parse(readFileSync('src/i18n/ui/de.json', 'utf8'));

export const locales = ['en', 'fr', 'de', 'nl', 'es', 'it', 'pt', 'pl', 'da', 'sv', 'no', 'fi', 'et', 'lv', 'lt'];

const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
const TURNSTILE_STUB = `(() => {
  const token = () => window.__TURNSTILE_TOKEN__ ?? '${E2E.passToken}';
  const fill = () => document.querySelectorAll('.cf-turnstile').forEach((el) => {
    let input = el.querySelector('input[name="cf-turnstile-response"]');
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'cf-turnstile-response';
      el.appendChild(input);
    }
    input.value = token();
  });
  window.__turnstileResets = 0;
  window.turnstile = {
    render: () => (fill(), 'stub'),
    reset: () => { window.__turnstileResets++; fill(); },
    remove() {},
    getResponse: token,
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fill);
  else fill();
})();`;

/** A unique name and address per test, so tests never collide in the shared database. */
export const unique = (label: string) => {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return { name: `E2E ${label} ${id}`, email: `e2e-${id}@example.eu` };
};

export const CODE_RE = /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/;

export const test = base.extend<{ thirdParty: string[]; cookiesSet: string[] }>({
  thirdParty: [
    async ({ context }, use) => {
      const blocked: string[] = [];
      await context.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith(E2E.origin) || url.startsWith('data:')) return route.continue();
        if (url.split('?')[0] === TURNSTILE_SCRIPT) {
          return route.fulfill({ contentType: 'text/javascript', body: TURNSTILE_STUB });
        }
        blocked.push(url);
        return route.abort('blockedbyclient');
      });
      await use(blocked);
      expect(blocked, 'requests to third parties').toEqual([]);
    },
    { auto: true },
  ],
  cookiesSet: [
    async ({ context }, use) => {
      const seen: string[] = [];
      context.on('response', async (res) => {
        const cookie = await res.headerValue('set-cookie').catch(() => null);
        if (cookie) seen.push(`${res.url()}: ${cookie}`);
      });
      await use(seen);
      expect(seen, 'Set-Cookie headers').toEqual([]);
      expect(await context.cookies(), 'cookies in the browser').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Fills in the signature form on the current page. */
export async function fillForm(
  page: import('@playwright/test').Page,
  { name, email, country = 'BE', updates = false, consent = true }: { name: string; email?: string; country?: string; updates?: boolean; consent?: boolean },
) {
  await page.locator('#sig-name').fill(name);
  if (country) await page.locator('#sig-country').selectOption(country);
  if (email) await page.locator('#sig-email').fill(email);
  if (updates) await page.locator('input[name="updates"]').check();
  if (consent) await page.locator('input[name="consent"]').check();
}
