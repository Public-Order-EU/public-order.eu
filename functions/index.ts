/**
 * GET / — send visitors to their language, based on Accept-Language.
 * Only fully translated languages are chosen; everything else goes to English.
 * (src/pages/index.astro is a static fallback for when this doesn't run.)
 */
import type { Env } from '../server/env';
import { redirect } from '../server/http';
import { isLocaleComplete } from '../src/i18n/dictionaries';
import { defaultLocale, negotiateLocale } from '../src/i18n/locales';

export const onRequestGet: PagesFunction<Env> = ({ request }) => {
  const preferred = negotiateLocale(request.headers.get('Accept-Language'));
  const lang = isLocaleComplete(preferred) ? preferred : defaultLocale;
  const url = new URL(request.url);
  return redirect(`/${lang}/${url.search}`, 302, {
    Vary: 'Accept-Language',
    'Cache-Control': 'private, max-age=0',
  });
};
