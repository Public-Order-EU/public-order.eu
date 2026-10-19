/**
 * Hashing and withdrawal codes (Web Crypto only — runs on Cloudflare Workers).
 */

/** Crockford base32: no I, L, O or U, so codes are easy to read and type. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 16; // 16 × 5 bits = 80 bits of entropy

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Salted hash of a normalised e-mail address, used for duplicate detection. */
export function hashEmail(email: string, salt: string): Promise<string> {
  return sha256Hex(`${salt}:email:${email}`);
}

/** Salted hash of a normalised withdrawal code. Only the hash is stored. */
export function hashCode(normalisedCode: string, salt: string): Promise<string> {
  return sha256Hex(`${salt}:code:${normalisedCode}`);
}

/** A new random withdrawal code, formatted as XXXX-XXXX-XXXX-XXXX. */
export function generateCode(): { display: string; normalised: string } {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  // 256 is a multiple of 32, so `b % 32` is unbiased.
  const normalised = [...bytes].map((b) => ALPHABET[b % 32]).join('');
  return { display: normalised.match(/.{4}/g)!.join('-'), normalised };
}

/**
 * Normalise user input to the canonical code, or return null if it can't be one.
 * Tolerates lower case, spaces, dashes and the usual look-alike characters.
 */
export function normalizeCode(input: string): string | null {
  const code = input
    .toUpperCase()
    .replace(/[\s\-_.]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0');
  if (code.length !== CODE_LENGTH) return null;
  for (const ch of code) if (!ALPHABET.includes(ch)) return null;
  return code;
}
