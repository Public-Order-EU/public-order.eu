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

export async function verifyTurnstile(
  token: string,
  secret: string,
  request: Request,
  urlOverride?: string,
): Promise<TurnstileResult> {
  if (!token) return 'missing';
  if (token.length > 2048) return 'fail';

  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) body.append('remoteip', ip); // passed to Turnstile only, never stored

  try {
    const res = await fetch(verifyUrl(urlOverride), { method: 'POST', body });
    if (!res.ok) return 'error';
    const data = (await res.json()) as { success?: boolean };
    return data.success ? 'pass' : 'fail';
  } catch {
    return 'error';
  }
}
