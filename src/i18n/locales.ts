/**
 * Supported languages. Shared by the Astro site and the Cloudflare Functions,
 * so keep this file free of Astro-specific imports.
 *
 * If you add or remove a locale, also update the `locales` array in astro.config.mjs
 * and src/i18n/dictionaries.ts.
 */
export const locales = ['en', 'fr', 'de', 'nl', 'es', 'it', 'pt', 'pl', 'da', 'sv', 'no', 'fi', 'et', 'lv', 'lt'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

interface LocaleInfo {
  /** Name of the language in that language (used in the switcher). */
  nativeName: string;
  /** English name (used for accessibility labels and docs). */
  englishName: string;
  /** Open Graph locale, e.g. fr_FR. */
  ogLocale: string;
}

export const localeInfo: Record<Locale, LocaleInfo> = {
  en: { nativeName: 'English', englishName: 'English', ogLocale: 'en_GB' },
  fr: { nativeName: 'Français', englishName: 'French', ogLocale: 'fr_FR' },
  de: { nativeName: 'Deutsch', englishName: 'German', ogLocale: 'de_DE' },
  nl: { nativeName: 'Nederlands', englishName: 'Dutch', ogLocale: 'nl_NL' },
  es: { nativeName: 'Español', englishName: 'Spanish', ogLocale: 'es_ES' },
  it: { nativeName: 'Italiano', englishName: 'Italian', ogLocale: 'it_IT' },
  pt: { nativeName: 'Português', englishName: 'Portuguese', ogLocale: 'pt_PT' },
  pl: { nativeName: 'Polski', englishName: 'Polish', ogLocale: 'pl_PL' },
  da: { nativeName: 'Dansk', englishName: 'Danish', ogLocale: 'da_DK' },
  sv: { nativeName: 'Svenska', englishName: 'Swedish', ogLocale: 'sv_SE' },
  no: { nativeName: 'Norsk', englishName: 'Norwegian', ogLocale: 'nb_NO' },
  fi: { nativeName: 'Suomi', englishName: 'Finnish', ogLocale: 'fi_FI' },
  et: { nativeName: 'Eesti', englishName: 'Estonian', ogLocale: 'et_EE' },
  lv: { nativeName: 'Latviešu', englishName: 'Latvian', ogLocale: 'lv_LV' },
  lt: { nativeName: 'Lietuvių', englishName: 'Lithuanian', ogLocale: 'lt_LT' },
};

/** Locales sorted by native name — the conventional order for European language switchers. */
export const localesByNativeName: Locale[] = [...locales].sort((a, b) =>
  localeInfo[a].nativeName.localeCompare(localeInfo[b].nativeName, 'en'),
);

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

/** Pick the best supported locale from an Accept-Language header. */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return defaultLocale;
  const ranked = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().toLowerCase().split(';');
      const q = params.find((p) => p.trim().startsWith('q='));
      return { tag, q: q ? Number(q.trim().slice(2)) || 0 : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of ranked) {
    const base = tag.split('-')[0];
    // Norwegian Bokmål / Nynorsk both map to "no".
    const normalised = base === 'nb' || base === 'nn' ? 'no' : base;
    if (isLocale(normalised)) return normalised;
  }
  return defaultLocale;
}
