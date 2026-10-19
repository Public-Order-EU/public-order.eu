import { describe, expect, it } from 'vitest';
import { generateCode, hashCode, hashEmail, normalizeCode, sha256Hex } from '../../server/crypto';

describe('generateCode', () => {
  it('produces XXXX-XXXX-XXXX-XXXX in Crockford base32', () => {
    for (let i = 0; i < 200; i++) {
      const { display, normalised } = generateCode();
      expect(display).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
      expect(display.replaceAll('-', '')).toBe(normalised);
      expect(normalizeCode(display)).toBe(normalised);
    }
  });

  it('does not repeat itself', () => {
    const codes = new Set(Array.from({ length: 1000 }, () => generateCode().normalised));
    expect(codes.size).toBe(1000);
  });
});

describe('normalizeCode', () => {
  it('accepts lower case, spaces, dashes, dots and underscores', () => {
    expect(normalizeCode(' abcd efgh-jkmn_pqrs ')).toBe('ABCDEFGHJKMNPQRS');
    expect(normalizeCode('ab.cd.ef.gh.jk.mn.pq.rs')).toBe('ABCDEFGHJKMNPQRS');
  });

  it('maps look-alike characters: I and L to 1, O to 0', () => {
    expect(normalizeCode('IIII-LLLL-OOOO-oooo')).toBe('1111111100000000');
  });

  it.each(['', 'ABCD-EFGH-JKMN', 'ABCD-EFGH-JKMN-PQRS-T', 'ABCD-EFGH-JKMN-PQRU', 'ABCD-EFGH-JKMN-PQR!'])(
    'rejects %j',
    (input) => expect(normalizeCode(input)).toBeNull(),
  );
});

describe('hashes', () => {
  it('sha256Hex matches a known vector', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('are deterministic and depend on the salt', async () => {
    expect(await hashEmail('a@b.eu', 'salt')).toBe(await hashEmail('a@b.eu', 'salt'));
    expect(await hashEmail('a@b.eu', 'salt')).not.toBe(await hashEmail('a@b.eu', 'other'));
    expect(await hashCode('ABCD', 'salt')).not.toBe(await hashCode('ABCD', 'other'));
  });

  it('separate e-mail and code hashes for the same input', async () => {
    expect(await hashEmail('x', 's')).not.toBe(await hashCode('x', 's'));
  });

  it('match scripts/hash-email.mjs (used to find signatures by e-mail)', async () => {
    const { execFileSync } = await import('node:child_process');
    const out = execFileSync('node', ['scripts/hash-email.mjs', '  A@B.eu '], {
      env: { ...process.env, HASH_SALT: 'test-salt' },
      encoding: 'utf8',
    });
    expect(out).toContain(await hashEmail('a@b.eu', 'test-salt'));
  });
});
