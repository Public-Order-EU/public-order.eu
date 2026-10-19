/** The API directly: status codes, origin checks, headers, caching. */
import { E2E } from './config.mjs';
import { en, escapeHtml, expect, test, unique } from './fixtures';
import { counter, signaturesByName } from './db';

const JSON_HEADERS = { Accept: 'application/json' };
const valid = (name: string, token = E2E.passToken) => ({ name, country: 'BE', consent: '1', lang: 'en', 'cf-turnstile-response': token });

const expectSecurityHeaders = (headers: Record<string, string>) => {
  expect(headers['content-security-policy']).toContain("default-src 'self'");
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['strict-transport-security']).toContain('max-age=');
  expect(headers['set-cookie']).toBeUndefined();
};

test('GET /api/count returns the count, cached for a minute', async ({ request }) => {
  const res = await request.get('/api/count');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Object.keys(body)).toEqual(['count']);
  expect(Number.isInteger(body.count)).toBe(true);
  expect(res.headers()['cache-control']).toBe('public, max-age=60');
  expect(res.headers()['content-type']).toContain('application/json');
  expectSecurityHeaders(res.headers());
});

test('invalid fields are rejected with 400 and the reason', async ({ request }) => {
  const cases: [Record<string, string>, string][] = [
    [{ ...valid('A') }, 'invalid_name'],
    [{ ...valid('x'.repeat(101)) }, 'invalid_name'],
    [{ ...valid('Valid Name'), country: 'ZZ' }, 'invalid_country'],
    [{ ...valid('Valid Name'), email: 'nope' }, 'invalid_email'],
    [{ name: 'Valid Name', country: 'BE', lang: 'en' }, 'consent_required'],
  ];
  for (const [form, error] of cases) {
    const res = await request.post('/api/sign', { form, headers: JSON_HEADERS });
    expect(res.status(), error).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error });
    expectSecurityHeaders(res.headers());
  }
});

test('a signature without a valid Turnstile token is never stored', async ({ request }) => {
  const before = counter();
  const cases: [string, number, string][] = [
    ['', 400, 'captcha_missing'],
    ['forged', 400, 'captcha_failed'],
    [E2E.foreignHostToken, 400, 'captcha_failed'],
    [E2E.downToken, 503, 'captcha_unavailable'],
  ];
  for (const [token, status, error] of cases) {
    const { name } = unique(`token-${error}`);
    const res = await request.post('/api/sign', { form: valid(name, token), headers: JSON_HEADERS });
    expect(res.status(), error).toBe(status);
    expect(await res.json()).toEqual({ ok: false, error });
    expect(signaturesByName(name)).toHaveLength(0);
  }

  // A plain form post (no JavaScript) gets the same answer as a page.
  const { name } = unique('token-html');
  const html = await request.post('/api/sign', { form: valid(name, '') });
  expect(html.status()).toBe(400);
  expect(html.headers()['content-type']).toContain('text/html');
  expect(await html.text()).toContain(escapeHtml(en.form.errors.captcha_missing));
  expect(signaturesByName(name)).toHaveLength(0);
  expect(counter()).toBe(before);
});

test('a second signature with the same address looks like a new one but is not stored', async ({ request }) => {
  const first = unique('dup-api');
  const signed = await request.post('/api/sign', { form: { ...valid(first.name), email: first.email }, headers: JSON_HEADERS });
  expect(signed.status()).toBe(200);
  const before = counter();

  const again = `${first.name} again`;
  const json = await request.post('/api/sign', { form: { ...valid(again), email: first.email }, headers: JSON_HEADERS });
  expect(json.status()).toBe(200);
  const body = await json.json();
  expect(Object.keys(body)).toEqual(['ok', 'code']);
  expect(body.ok).toBe(true);

  // The code shown matches no signature.
  const del = await request.post('/api/delete', { form: { code: body.code }, headers: JSON_HEADERS });
  expect(await del.json()).toEqual({ ok: false, error: 'not_found' });

  // Without JavaScript: the same thanks page as for a new signature.
  const html = await request.post('/api/sign', { form: { ...valid(again), email: first.email.toUpperCase() } });
  expect(html.status()).toBe(200);
  expect(await html.text()).toContain(escapeHtml(en.thanks.title));

  expect(signaturesByName(again)).toHaveLength(0);
  expect(signaturesByName(first.name)).toHaveLength(1);
  expect(counter()).toBe(before);
});

test('posts from another site are rejected (JSON and HTML)', async ({ request }) => {
  const { name } = unique('cross-origin');
  const json = await request.post('/api/sign', {
    form: valid(name),
    headers: { ...JSON_HEADERS, Origin: 'https://evil.example' },
  });
  expect(json.status()).toBe(403);
  expect(await json.json()).toEqual({ ok: false, error: 'forbidden' });

  const html = await request.post('/api/sign', { form: valid(name), headers: { Origin: 'https://evil.example' } });
  expect(html.status()).toBe(403);
  expect(html.headers()['content-type']).toContain('text/html');

  const del = await request.post('/api/delete', {
    form: { code: 'ABCD-EFGH-JKMN-PQRS' },
    headers: { ...JSON_HEADERS, Origin: 'https://evil.example' },
  });
  expect(del.status()).toBe(403);
  expect(signaturesByName(name)).toHaveLength(0);
});

test('a same-origin post is accepted', async ({ request }) => {
  const { name } = unique('same-origin');
  const res = await request.post('/api/sign', { form: valid(name), headers: { ...JSON_HEADERS, Origin: E2E.origin } });
  expect(res.status()).toBe(200);
  expect(signaturesByName(name)).toHaveLength(1);
});

test('oversized bodies are refused before parsing', async ({ request }) => {
  const res = await request.post('/api/sign', {
    form: { ...valid('Big Body'), filler: 'x'.repeat(20_000) },
    headers: JSON_HEADERS,
  });
  expect(res.status()).toBeGreaterThanOrEqual(400);
  expect(signaturesByName('Big Body')).toHaveLength(0);
});

test('only POST is allowed on the write endpoints', async ({ request }) => {
  // Pages Functions answer other methods with 404 (no handler).
  expect([404, 405]).toContain((await request.get('/api/sign')).status());
  expect([404, 405]).toContain((await request.get('/api/delete')).status());
});

test('GET / redirects to a language, per visitor', async ({ request }) => {
  const res = await request.get('/', { maxRedirects: 0, headers: { 'Accept-Language': 'de-DE,de;q=0.9' } });
  expect(res.status()).toBe(302);
  // Only complete translations are chosen; the others fall back to English.
  expect(res.headers()['location']).toMatch(/^\/(de|en)\/$/);
  expect(res.headers()['vary']).toContain('Accept-Language');
  expect(res.headers()['cache-control']).toBe('private, max-age=0');

  const query = await request.get('/?ref=test', { maxRedirects: 0 });
  expect(query.headers()['location']).toBe('/en/?ref=test');
});

test('static pages carry the security headers', async ({ request }) => {
  for (const path of ['/en/', '/en/privacy/', '/de/delete/']) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
    expectSecurityHeaders(res.headers());
  }
});

test('inline scripts run only if their hash is listed', async ({ request }) => {
  const scriptSrc = (csp: string) => csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src '))!;

  // Static pages: the build swaps 'unsafe-inline' for the hashes of Astro's inline scripts.
  const page = scriptSrc((await request.get('/en/')).headers()['content-security-policy']);
  expect(page).not.toContain("'unsafe-inline'");
  expect(page).toMatch(/'sha256-[A-Za-z0-9+/]+=*'/);
  expect(page).toContain('https://challenges.cloudflare.com');

  // Pages rendered by the Functions contain no scripts, so none may run.
  const fn = await request.post('/api/sign', { form: valid('Csp Check', '') });
  expect(scriptSrc(fn.headers()['content-security-policy'])).toBe("script-src 'none'");
});
