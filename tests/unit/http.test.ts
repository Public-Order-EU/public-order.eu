import { describe, expect, it } from 'vitest';
import type { Env } from '../../server/env';
import { SECURITY_HEADERS, bodyTooLarge, escapeHtml, htmlPage, isSameOrigin, json, redirect, wantsJson } from '../../server/http';

const env = { SITE_ORIGIN: 'https://public-order.eu' } as Env;
const post = (headers: Record<string, string>, url = 'https://abc.public-order-eu.pages.dev/api/sign') =>
  new Request(url, { method: 'POST', headers });

describe('isSameOrigin', () => {
  it('accepts the configured origin and the request origin', () => {
    expect(isSameOrigin(post({ Origin: 'https://public-order.eu' }), env)).toBe(true);
    expect(isSameOrigin(post({ Origin: 'https://abc.public-order-eu.pages.dev' }), env)).toBe(true);
  });

  it.each(['https://evil.example', 'https://public-order.eu.evil.example', 'http://public-order.eu', 'null'])(
    'rejects Origin %s',
    (Origin) => expect(isSameOrigin(post({ Origin }), env)).toBe(false),
  );

  it('falls back to Sec-Fetch-Site without an Origin header', () => {
    expect(isSameOrigin(post({ 'Sec-Fetch-Site': 'same-origin' }), env)).toBe(true);
    expect(isSameOrigin(post({ 'Sec-Fetch-Site': 'none' }), env)).toBe(true);
    expect(isSameOrigin(post({ 'Sec-Fetch-Site': 'cross-site' }), env)).toBe(false);
    expect(isSameOrigin(post({ 'Sec-Fetch-Site': 'same-site' }), env)).toBe(false);
    expect(isSameOrigin(post({}), env)).toBe(true); // very old browsers
  });
});

describe('request helpers', () => {
  it('bodyTooLarge reads Content-Length', () => {
    expect(bodyTooLarge(post({ 'Content-Length': '16384' }))).toBe(false);
    expect(bodyTooLarge(post({ 'Content-Length': '16385' }))).toBe(true);
    expect(bodyTooLarge(post({ 'Content-Length': '5000' }), 4096)).toBe(true);
    expect(bodyTooLarge(post({}))).toBe(false);
  });

  it('wantsJson only for Accept: application/json', () => {
    expect(wantsJson(post({ Accept: 'application/json' }))).toBe(true);
    expect(wantsJson(post({ Accept: 'text/html,application/xhtml+xml' }))).toBe(false);
    expect(wantsJson(post({}))).toBe(false);
  });

  it('escapeHtml escapes the five special characters', () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&</a>`)).toBe('&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
  });
});

describe('responses', () => {
  const expectSecurityHeaders = (res: Response) => {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) expect(res.headers.get(k)).toBe(v);
  };

  it('json sets the type, no-store and the security headers', async () => {
    const res = json({ ok: true }, 201);
    expect(res.status).toBe(201);
    expect(res.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expectSecurityHeaders(res);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('json keeps an explicit Cache-Control', () => {
    expect(json({}, 200, { 'Cache-Control': 'public, max-age=60' }).headers.get('Cache-Control')).toBe('public, max-age=60');
  });

  it('redirect sets Location and the security headers', () => {
    const res = redirect('/en/', 302, { Vary: 'Accept-Language' });
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/en/');
    expect(res.headers.get('Vary')).toBe('Accept-Language');
    expectSecurityHeaders(res);
  });

  it('htmlPage escapes the title and is localised', async () => {
    const res = htmlPage({ lang: 'de', title: '<script>alert(1)</script>', bodyHtml: '<p>ok</p>', status: 400 });
    expect(res.status).toBe(400);
    expect(res.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expectSecurityHeaders(res);
    const html = await res.text();
    expect(html).toContain('<html lang="de">');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('<meta name="robots" content="noindex">');
  });
});
