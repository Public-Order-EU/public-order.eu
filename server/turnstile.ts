/**
 * Server-side Turnstile verification.
 * https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
export const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * The end-to-end tests point Turnstile at a local mock (TURNSTILE_VERIFY_URL).
 * Only loopback addresses are accepted, so a stray setting in production can
 * never send tokens anywhere else: it falls back to Cloudflare.
 */
export function verifyUrl(override?: string): string {
  if (!override) return VERIFY_URL;
  try {
    const url = new URL(override);
    if (url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) return url.href;
  } catch {
    /* invalid URL */
  }
  return VERIFY_URL;
}

/**
 * - pass:    valid token
 * - fail:    token present but rejected (expired, reused, forged…)
 * - missing: no token (visitor without JavaScript, or widget didn't load)
 * - error:   Turnstile could not be reached
 */
export type TurnstileResult = 'pass' | 'fail' | 'missing' | 'error';

/**
 * Cloudflare's dummy secret keys for local development. Their answers carry
 * no real hostname, so the hostname check is skipped for them; they pass or
 * fail any token anyway, so this weakens nothing.
 * https://developers.cloudflare.com/turnstile/troubleshooting/testing/
 */
const TEST_SECRETS = new Set(['1x', '2x', '3x'].map((p) => `${p}0000000000000000000000000000000AA`));

/** The hostnames a token may come from: the public site, and the host this request was sent to (previews). */
function allowedHosts(request: Request, siteOrigin?: string): Set<string> {
  const hosts = new Set([new URL(request.url).hostname]);
  try {
    if (siteOrigin) hosts.add(new URL(siteOrigin).hostname);
  } catch {
    /* invalid SITE_ORIGIN: only the request's own host */
  }
  return hosts;
}

export async function verifyTurnstile(
  token: string,
  request: Request,
  env: { TURNSTILE_SECRET_KEY: string; SITE_ORIGIN?: string; TURNSTILE_VERIFY_URL?: string },
): Promise<TurnstileResult> {
  if (!token) return 'missing';
  if (token.length > 2048) return 'fail';

  const body = new FormData();
  body.append('secret', env.TURNSTILE_SECRET_KEY);
  body.append('response', token);
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) body.append('remoteip', ip); // passed to Turnstile only, never stored

  try {
    const res = await fetch(verifyUrl(env.TURNSTILE_VERIFY_URL), { method: 'POST', body });
    if (!res.ok) return 'error';
    const data = (await res.json()) as { success?: boolean; hostname?: string };
    if (!data.success) return 'fail';
    // A token solved on another site that embeds our widget is not ours to accept.
    if (TEST_SECRETS.has(env.TURNSTILE_SECRET_KEY)) return 'pass';
    return typeof data.hostname === 'string' && allowedHosts(request, env.SITE_ORIGIN).has(data.hostname) ? 'pass' : 'fail';
  } catch {
    return 'error';
  }
}
