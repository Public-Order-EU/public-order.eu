/**
 * Central settings. Edit this file to change the goal, the counter, contact
 * addresses and so on — then commit; Cloudflare Pages rebuilds automatically.
 */
export const siteConfig = {
  url: 'https://public-order.eu',

  /** Signature goal shown next to the counter. */
  signatureGoal: 100_000,

  /**
   * Added to the live count from the database — e.g. paper signatures or
   * signatures collected on another platform.
   */
  countOffset: 0,

  /**
   * Count shown before the live number loads (and to visitors without JavaScript).
   * Update it from time to time, e.g. with the result of /api/count.
   */
  fallbackCount: 0,

  /** Hide the number until it reaches this threshold (shows only the goal). */
  showCountFrom: 100,

  contact: {
    general: 'contact@public-order.eu',
    privacy: 'privacy@public-order.eu',
    press: 'press@public-order.eu',
  },

  /**
   * Cloudflare Turnstile site key. It is public (every page contains it). Builds on
   * Cloudflare Pages (CF_PAGES is set) use the real key; local builds use Cloudflare's
   * always-pass test key, which matches the test secret in .dev.vars.example.
   * PUBLIC_TURNSTILE_SITE_KEY overrides both.
   */
  turnstileSiteKey:
    import.meta.env.PUBLIC_TURNSTILE_SITE_KEY ||
    (process.env.CF_PAGES ? '0x4AAAAAAFbkJ37jCD4RKJK_' : '1x00000000000000000000AA'),

  /** The site's public source code, linked in the footer. */
  sourceUrl: 'https://github.com/Public-Order-EU/public-order.eu',

  /** Where translators can contribute (repository, form, e-mail…). */
  translationsUrl: 'mailto:contact@public-order.eu?subject=Translation',

  /** Optional hashtag used in share links (without #). */
  hashtag: 'PublicOrderEU',
} as const;
