import { isAllowedCountry } from '../src/data/countries';
import { defaultLocale, isLocale, type Locale } from '../src/i18n/locales';

/** Error codes match the keys of `form.errors` in the UI dictionaries. */
export type SignError =
  | 'invalid_name'
  | 'invalid_country'
  | 'invalid_email'
  | 'consent_required'
  | 'captcha_failed'
  | 'captcha_missing'
  | 'captcha_unavailable'
  | 'duplicate'
  | 'forbidden'
  | 'rate_limited'
  | 'generic';

export interface Signature {
  name: string;
  country: string;
  email: string | null;
  wantsUpdates: boolean;
  lang: Locale;
}

// Deliberately simple: the real check is whether mail can be delivered.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const field = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === 'string' ? value : '';
};

export function readLang(form: FormData): Locale {
  const lang = field(form, 'lang');
  return isLocale(lang) ? lang : defaultLocale;
}

/** Validate and normalise a submitted signature form. */
export function parseSignature(form: FormData): { ok: true; value: Signature } | { ok: false; error: SignError } {
  const name = field(form, 'name')
    .normalize('NFC')
    // Strip control characters, collapse whitespace.
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (name.length < 2 || name.length > 100) return { ok: false, error: 'invalid_name' };

  const country = field(form, 'country').trim().toUpperCase();
  if (!isAllowedCountry(country)) return { ok: false, error: 'invalid_country' };

  const email = field(form, 'email').trim().toLowerCase();
  if (email && (email.length > 254 || !EMAIL_RE.test(email))) return { ok: false, error: 'invalid_email' };

  if (field(form, 'consent') !== '1') return { ok: false, error: 'consent_required' };

  return {
    ok: true,
    value: {
      name,
      country,
      email: email || null,
      wantsUpdates: Boolean(email) && field(form, 'updates') === '1',
      lang: readLang(form),
    },
  };
}
