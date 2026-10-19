/**
 * Countries offered in the signature form (ISO 3166-1 alpha-2).
 * EU-27 + EEA/EFTA + United Kingdom. "XX" means "other country".
 *
 * Names are localised automatically with Intl.DisplayNames at build time,
 * so translators don't need to translate country names.
 */
export const countryCodes = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO', 'CH', 'GB',
] as const;

export const OTHER_COUNTRY = 'XX';

export function isAllowedCountry(code: string): boolean {
  return code === OTHER_COUNTRY || (countryCodes as readonly string[]).includes(code);
}
