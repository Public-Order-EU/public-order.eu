/**
 * POST /api/delete — withdraw a signature with its withdrawal code.
 * The row is deleted permanently and the counter adjusted in one transaction.
 */
import type { Env } from '../../server/env';
import { hashCode, normalizeCode } from '../../server/crypto';
import { bodyTooLarge, button, htmlPage, isSameOrigin, json, p, wantsJson } from '../../server/http';
import { readLang } from '../../server/validate';
import { getDictionary } from '../../src/i18n/dictionaries';
import { defaultLocale, type Locale } from '../../src/i18n/locales';

type Outcome = 'success' | 'not_found' | 'invalid' | 'forbidden' | 'generic';

const STATUS: Record<Outcome, number> = { success: 200, not_found: 404, invalid: 400, forbidden: 403, generic: 500 };

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const asJson = wantsJson(request);
  let lang: Locale = defaultLocale;

  const respond = (outcome: Outcome) => {
    if (asJson) return json(outcome === 'success' ? { ok: true } : { ok: false, error: outcome }, STATUS[outcome]);
    const t = getDictionary(lang);
    const message = {
      success: t.delete.success,
      not_found: t.delete.notFound,
      invalid: t.delete.invalid,
      forbidden: t.form.errors.forbidden,
      generic: t.form.errors.generic,
    }[outcome];
    return htmlPage({
      lang,
      title: t.delete.title,
      status: STATUS[outcome],
      bodyHtml:
        `<div class="box${outcome === 'success' ? '' : ' notice'}">${p(message)}</div>` +
        (outcome === 'success' ? button(`/${lang}/`, t.thanks.backHome) : button(`/${lang}/delete/`, t.delete.title)),
    });
  };

  if (!isSameOrigin(request, env)) return respond('forbidden');
  if (bodyTooLarge(request, 4 * 1024)) return respond('invalid');

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return respond('invalid');
  }
  lang = readLang(form);

  const code = normalizeCode(String(form.get('code') || ''));
  if (!code) return respond('invalid');
  const hash = await hashCode(code, env.HASH_SALT);

  try {
    const [, deleted] = await env.DB.batch([
      // Runs first, while the row still exists: subtract 1 only if it was counted.
      env.DB.prepare(
        `UPDATE stats
            SET value = MAX(0, value - (SELECT COUNT(*) FROM signatures WHERE delete_hash = ?1 AND verified = 1))
          WHERE key = 'verified_count'`,
      ).bind(hash),
      env.DB.prepare(`DELETE FROM signatures WHERE delete_hash = ?1`).bind(hash),
    ]);
    return respond(deleted.meta.changes > 0 ? 'success' : 'not_found');
  } catch (err) {
    console.error('delete: database error', err);
    return respond('generic');
  }
};
