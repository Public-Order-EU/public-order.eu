import { getCollection, type CollectionEntry } from 'astro:content';
import { getDictionary, isLocaleComplete } from './dictionaries';
import { defaultLocale, locales, type Locale } from './locales';

export { format, getDictionary, isLocaleComplete } from './dictionaries';

/** Static paths for every `[lang]` page. */
export function localeStaticPaths() {
  return locales.map((lang) => ({ params: { lang } }));
}

/** Build a locale-prefixed path, e.g. localePath('fr', 'faq') → "/fr/faq/". */
export function localePath(lang: Locale, slug = ''): string {
  const clean = slug.replace(/^\/+|\/+$/g, '');
  return clean ? `/${lang}/${clean}/` : `/${lang}/`;
}

/** Strip the locale prefix from a pathname: "/fr/faq/" → "faq". */
export function slugFromPath(pathname: string): string {
  return pathname.split('/').filter(Boolean).slice(1).join('/');
}

/** Locales for which a UI-only page (home, share…) is fully translated. */
export function uiReadyLocales(): Locale[] {
  return locales.filter(isLocaleComplete);
}

/**
 * Load a long-form page (petition, privacy, legal) in the requested language,
 * falling back to English. Also returns which locales have a real translation.
 */
export async function getLocalizedPage(slug: string, lang: Locale) {
  const all = await getCollection('pages');
  const find = (l: Locale) => all.find((e: CollectionEntry<'pages'>) => e.id === `${l}/${slug}`);
  const entry = find(lang) ?? find(defaultLocale);
  if (!entry) throw new Error(`Missing content page "${defaultLocale}/${slug}"`);
  const translated = locales.filter((l) => isLocaleComplete(l) && find(l));
  return { entry, isFallback: !find(lang), translated };
}

/** Same as getLocalizedPage, for the FAQ data collection. */
export async function getLocalizedFaq(lang: Locale) {
  const all = await getCollection('faq');
  const find = (l: Locale) => all.find((e: CollectionEntry<'faq'>) => e.id === l);
  const entry = find(lang) ?? find(defaultLocale);
  if (!entry) throw new Error(`Missing FAQ "${defaultLocale}"`);
  const translated = locales.filter((l) => isLocaleComplete(l) && find(l));
  return { entry, isFallback: !find(lang), translated };
}

export function useTranslations(lang: Locale) {
  return getDictionary(lang);
}
