/**
 * Loads every UI dictionary and merges it over English, so a missing key in a
 * translation silently falls back to the English string.
 *
 * Shared by the Astro site and the Cloudflare Functions (plain TS + JSON only).
 */
import type { Locale } from './locales';
import en from './ui/en.json';
import fr from './ui/fr.json';
import de from './ui/de.json';
import nl from './ui/nl.json';
import es from './ui/es.json';
import it from './ui/it.json';
import pt from './ui/pt.json';
import pl from './ui/pl.json';
import da from './ui/da.json';
import sv from './ui/sv.json';
import no from './ui/no.json';
import fi from './ui/fi.json';
import et from './ui/et.json';
import lv from './ui/lv.json';
import lt from './ui/lt.json';

export type Dictionary = typeof en;

type DeepPartial<T> = T extends readonly unknown[] ? T : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

const raw: Record<Locale, DeepPartial<Dictionary>> = { en, fr, de, nl, es, it, pt, pl, da, sv, no, fi, et, lv, lt };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Objects are merged recursively; strings and arrays from the translation replace English. */
function merge<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return (override === undefined || override === '' ? base : override) as T;
  }
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    out[key] = merge((base as Record<string, unknown>)[key], value);
  }
  return out as T;
}

const merged = Object.fromEntries(
  Object.entries(raw).map(([lang, dict]) => [lang, merge(en, dict)]),
) as Record<Locale, Dictionary>;

export function getDictionary(lang: Locale): Dictionary {
  return merged[lang];
}

/** A locale is "complete" when translators set `"_status": "complete"` in its JSON file. */
export function isLocaleComplete(lang: Locale): boolean {
  return raw[lang]._status === 'complete';
}

/** Replace {placeholders} in a string. */
export function format(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}
