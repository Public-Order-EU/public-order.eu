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
  const env = { TURNSTILE_SECRET_KEY: 'secret', SITE_ORIGIN: 'https://public-order.eu' };
  afterEach(() => vi.unstubAllGlobals());

  const stubFetch = (response: () => Response | Promise<Response>) => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => response());
    vi.stubGlobal('fetch', fetch);
    return fetch;
  };

  it('returns missing without a token, without calling Cloudflare', async () => {
    const fetch = stubFetch(() => Response.json({ success: true, hostname: 'public-order.eu' }));
    expect(await verifyTurnstile('', request, env)).toBe('missing');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects absurdly long tokens without calling Cloudflare', async () => {
    const fetch = stubFetch(() => Response.json({ success: true, hostname: 'public-order.eu' }));
    expect(await verifyTurnstile('x'.repeat(2049), request, env)).toBe('fail');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends secret, token and IP to siteverify', async () => {
    const fetch = stubFetch(() => Response.json({ success: true, hostname: 'public-order.eu' }));
    expect(await verifyTurnstile('token', request, env)).toBe('pass');
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(VERIFY_URL);
    const body = init.body as FormData;
    expect(body.get('secret')).toBe('secret');
    expect(body.get('response')).toBe('token');
    expect(body.get('remoteip')).toBe('203.0.113.7');
  });

  it('maps the answers', async () => {
    stubFetch(() => Response.json({ success: false, 'error-codes': ['invalid-input-response'] }));
    expect(await verifyTurnstile('token', request, env)).toBe('fail');
    stubFetch(() => new Response('oops', { status: 500 }));
    expect(await verifyTurnstile('token', request, env)).toBe('error');
    stubFetch(() => Promise.reject(new Error('network down')));
    expect(await verifyTurnstile('token', request, env)).toBe('error');
  });

  it('accepts tokens only from our own hostnames', async () => {
    const answer = (hostname?: string) => stubFetch(() => Response.json({ success: true, hostname }));
    answer('evil.example');
    expect(await verifyTurnstile('token', request, env)).toBe('fail');
    answer(undefined);
    expect(await verifyTurnstile('token', request, env)).toBe('fail');
    answer('public-order.eu.evil.example');
    expect(await verifyTurnstile('token', request, env)).toBe('fail');

    // A preview deployment: the host the request was sent to is allowed too.
    const preview = new Request('https://abc123.public-order-eu.pages.dev/api/sign');
    answer('abc123.public-order-eu.pages.dev');
    expect(await verifyTurnstile('token', preview, env)).toBe('pass');
    answer('public-order.eu');
    expect(await verifyTurnstile('token', preview, env)).toBe('pass');
    answer('other.pages.dev');
    expect(await verifyTurnstile('token', preview, env)).toBe('fail');
  });

  it("skips the hostname check only for Cloudflare's dummy secrets", async () => {
    stubFetch(() => Response.json({ success: true, hostname: 'example.com' }));
    const dev = { ...env, TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA' };
    expect(await verifyTurnstile('token', request, dev)).toBe('pass');
    expect(await verifyTurnstile('token', request, env)).toBe('fail');
  });
});
