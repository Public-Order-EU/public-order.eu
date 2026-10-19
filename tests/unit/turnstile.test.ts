import { afterEach, describe, expect, it, vi } from 'vitest';
import { VERIFY_URL, verifyTurnstile, verifyUrl } from '../../server/turnstile';

describe('verifyUrl', () => {
  it('uses Cloudflare by default', () => expect(verifyUrl()).toBe(VERIFY_URL));

  it.each(['http://127.0.0.1:8799/siteverify', 'http://localhost:8799/', 'http://[::1]:8799/'])(
    'allows the loopback test override %s',
    (url) => expect(verifyUrl(url)).toBe(new URL(url).href),
  );

  it.each([
    'https://evil.example/siteverify',
    'http://127.0.0.1.evil.example/',
    'http://localhost.evil.example/',
    'https://127.0.0.1:8799/', // https is not used by the mock: keep the rule strict
    'http://user@evil.example/',
    'not a url',
    'file:///etc/passwd',
  ])('ignores the override %s and uses Cloudflare', (url) => expect(verifyUrl(url)).toBe(VERIFY_URL));
});

describe('verifyTurnstile', () => {
  const request = new Request('https://public-order.eu/api/sign', { headers: { 'CF-Connecting-IP': '203.0.113.7' } });
  afterEach(() => vi.unstubAllGlobals());

  const stubFetch = (response: () => Response | Promise<Response>) => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => response());
    vi.stubGlobal('fetch', fetch);
    return fetch;
  };

  it('returns missing without a token, without calling Cloudflare', async () => {
    const fetch = stubFetch(() => Response.json({ success: true }));
    expect(await verifyTurnstile('', 'secret', request)).toBe('missing');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects absurdly long tokens without calling Cloudflare', async () => {
    const fetch = stubFetch(() => Response.json({ success: true }));
    expect(await verifyTurnstile('x'.repeat(2049), 'secret', request)).toBe('fail');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends secret, token and IP to siteverify', async () => {
    const fetch = stubFetch(() => Response.json({ success: true }));
    expect(await verifyTurnstile('token', 'secret', request)).toBe('pass');
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(VERIFY_URL);
    const body = init.body as FormData;
    expect(body.get('secret')).toBe('secret');
    expect(body.get('response')).toBe('token');
    expect(body.get('remoteip')).toBe('203.0.113.7');
  });

  it('maps the answers', async () => {
    stubFetch(() => Response.json({ success: false, 'error-codes': ['invalid-input-response'] }));
    expect(await verifyTurnstile('token', 'secret', request)).toBe('fail');
    stubFetch(() => new Response('oops', { status: 500 }));
    expect(await verifyTurnstile('token', 'secret', request)).toBe('error');
    stubFetch(() => Promise.reject(new Error('network down')));
    expect(await verifyTurnstile('token', 'secret', request)).toBe('error');
  });
});
