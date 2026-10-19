/** Bindings and variables available to the Pages Functions (see wrangler.toml). */
export interface Env {
  /** D1 database with the `signatures` and `stats` tables. */
  DB: D1Database;
  /** Turnstile secret key (secret). */
  TURNSTILE_SECRET_KEY: string;
  /**
   * Long random string used to hash e-mail addresses and withdrawal codes (secret).
   * NEVER change it once signatures exist: duplicate detection and withdrawal
   * codes would stop working.
   */
  HASH_SALT: string;
  /** Public origin, e.g. https://public-order.eu. */
  SITE_ORIGIN: string;
  /**
   * "true" (default) stores signatures that come without a Turnstile token —
   * e.g. from visitors without JavaScript — as unverified, for manual review.
   * Set to "false" to reject them instead (useful under a spam wave).
   */
  ACCEPT_UNVERIFIED?: string;
  /** Tests only: a loopback URL of a mock siteverify endpoint (see server/turnstile.ts). */
  TURNSTILE_VERIFY_URL?: string;
}
