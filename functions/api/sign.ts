/**
 * POST /api/sign — record a signature.
 *
 * Works in two modes:
 *  - JavaScript (fetch with Accept: application/json) → JSON response;
 *  - plain HTML form post (no JavaScript) → a localised HTML page.
 *
 * Every signature needs a valid Turnstile token, so the form needs JavaScript.
 * Posts without one (bots, or browsers without JavaScript) are rejected.
 */
import type { Env } from '../../server/env';
import { generateCode, hashCode, hashEmail } from '../../server/crypto';
import { bodyTooLarge, button, htmlPage, isSameOrigin, json, p, escapeHtml, wantsJson } from '../../server/http';
import { verifyTurnstile } from '../../server/turnstile';
import { parseSignature, readLang, type SignError } from '../../server/validate';
import { getDictionary } from '../../src/i18n/dictionaries';
import { defaultLocale, type Locale } from '../../src/i18n/locales';

const STATUS: Record<SignError, number> = {
  invalid_name: 400,
  invalid_country: 400,
  invalid_email: 400,
  consent_required: 400,
  captcha_failed: 400,
  captcha_missing: 400,
  captcha_unavailable: 503,
  duplicate: 409,
  forbidden: 403,
  rate_limited: 429,
  generic: 500,
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const asJson = wantsJson(request);
  let lang: Locale = defaultLocale;

  const fail = (error: SignError) => {
    if (asJson) return json({ ok: false, error }, STATUS[error]);
    const t = getDictionary(lang);
    return htmlPage({
      lang,
      title: t.form.title,
      status: STATUS[error],
      bodyHtml: `<div class="box notice">${p(t.form.errors[error])}</div>${button(`/${lang}/#sign`, t.nav.sign)}`,
    });
  };

  if (!isSameOrigin(request, env)) return fail('forbidden');
  if (bodyTooLarge(request)) return fail('generic');

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail('generic');
  }
  lang = readLang(form);

  // Honeypot: real visitors never fill this hidden field. Pretend success.
  if (String(form.get('website') || '').trim()) {
    return asJson ? json({ ok: true, code: generateCode().display }) : success(lang, generateCode().display);
  }

  const parsed = parseSignature(form);
  if (!parsed.ok) return fail(parsed.error);
  const sig = parsed.value;

  const turnstile = await verifyTurnstile(String(form.get('cf-turnstile-response') || ''), env.TURNSTILE_SECRET_KEY, request, env.TURNSTILE_VERIFY_URL);
  if (turnstile === 'missing') return fail('captcha_missing');
  if (turnstile === 'error') return fail('captcha_unavailable');
  if (turnstile !== 'pass') return fail('captcha_failed');

  const code = generateCode();
  const [deleteHash, emailHash] = await Promise.all([
    hashCode(code.normalised, env.HASH_SALT),
    sig.email ? hashEmail(sig.email, env.HASH_SALT) : Promise.resolve(null),
  ]);

  const insert = env.DB.prepare(
    `INSERT INTO signatures (name, country, email, email_hash, wants_updates, lang, verified, delete_hash)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
  ).bind(
    sig.name,
    sig.country,
    sig.wantsUpdates ? sig.email : null, // the address itself is kept only if updates were requested
    emailHash,
    sig.wantsUpdates ? 1 : 0,
    sig.lang,
    1, // verified: every stored signature passed Turnstile
    deleteHash,
  );
  const increment = env.DB.prepare(`UPDATE stats SET value = value + 1 WHERE key = 'verified_count'`);

  try {
    // A batch runs as one transaction: the counter only moves if the insert succeeds.
    await env.DB.batch([insert, increment]);
  } catch (err) {
    if (String(err).includes('UNIQUE') && String(err).includes('email_hash')) return fail('duplicate');
    console.error('sign: database error', err);
    return fail('generic');
  }

  return asJson ? json({ ok: true, code: code.display }) : success(lang, code.display);
};

/** Thank-you page for plain form posts (mirrors src/pages/[lang]/thanks.astro). */
function success(lang: Locale, code: string): Response {
  const t = getDictionary(lang);
  return htmlPage({
    lang,
    title: t.thanks.title,
    bodyHtml: [
      p(t.thanks.lead),
      `<div class="box"><h2>${escapeHtml(t.thanks.codeTitle)}</h2>${p(t.thanks.codeText, 'muted')}<p><span class="code">${escapeHtml(code)}</span></p><p><a href="/${lang}/delete/">${escapeHtml(t.nav.delete)}</a></p></div>`,
      `<h2>${escapeHtml(t.thanks.nextTitle)}</h2>`,
      p(t.thanks.nextText),
      button(`/${lang}/share/`, t.thanks.shareButton),
      button(`/${lang}/`, t.thanks.backHome),
    ].join('\n'),
  });
}
