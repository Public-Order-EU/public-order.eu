import { describe, expect, it } from 'vitest';
import { parseSignature, readLang } from '../../server/validate';

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};
const valid = { name: 'Alex Example', country: 'BE', email: '', consent: '1', lang: 'nl' };

describe('parseSignature', () => {
  it('accepts a minimal signature (no e-mail)', () => {
    expect(parseSignature(form(valid))).toEqual({
      ok: true,
      value: { name: 'Alex Example', country: 'BE', email: null, wantsUpdates: false, lang: 'nl' },
    });
  });

  it('normalises the name: control characters, whitespace, NFC', () => {
    const r = parseSignature(form({ ...valid, name: '  Zé​no \n\t  Doe ' }));
    expect(r.ok && r.value.name).toBe('Zé no Doe');
  });

  it.each([
    ['', 'too short'],
    ['A', 'one letter'],
    ['   ​ ', 'only invisible characters'],
    ['x'.repeat(101), 'too long'],
  ])('rejects the name %j (%s)', (name) => {
    expect(parseSignature(form({ ...valid, name }))).toEqual({ ok: false, error: 'invalid_name' });
  });

  it('accepts names of exactly 2 and 100 characters', () => {
    expect(parseSignature(form({ ...valid, name: 'Al' })).ok).toBe(true);
    expect(parseSignature(form({ ...valid, name: 'x'.repeat(100) })).ok).toBe(true);
  });

  it('upper-cases the country and accepts XX (other)', () => {
    const r = parseSignature(form({ ...valid, country: ' fr ' }));
    expect(r.ok && r.value.country).toBe('FR');
    expect(parseSignature(form({ ...valid, country: 'XX' })).ok).toBe(true);
  });

  it.each(['', 'US', 'ZZ', 'BEL', 'B'])('rejects the country %j', (country) => {
    expect(parseSignature(form({ ...valid, country }))).toEqual({ ok: false, error: 'invalid_country' });
  });

  it('lower-cases and trims the e-mail', () => {
    const r = parseSignature(form({ ...valid, email: '  Alex.Example@Mail.EU ' }));
    expect(r.ok && r.value.email).toBe('alex.example@mail.eu');
  });

  it.each(['no-at-sign', 'a@b', 'a b@c.eu', '@c.eu', `${'a'.repeat(250)}@c.eu`])('rejects the e-mail %j', (email) => {
    expect(parseSignature(form({ ...valid, email }))).toEqual({ ok: false, error: 'invalid_email' });
  });

  it('requires consent', () => {
    expect(parseSignature(form({ ...valid, consent: '' }))).toEqual({ ok: false, error: 'consent_required' });
    expect(parseSignature(form({ ...valid, consent: 'yes' }))).toEqual({ ok: false, error: 'consent_required' });
    const { consent: _, ...withoutConsent } = valid;
    expect(parseSignature(form(withoutConsent))).toEqual({ ok: false, error: 'consent_required' });
  });

  it('only wants updates when an e-mail is given and the box is ticked', () => {
    const updates = (email: string, box: string) => {
      const r = parseSignature(form({ ...valid, email, updates: box }));
      return r.ok && r.value.wantsUpdates;
    };
    expect(updates('a@b.eu', '1')).toBe(true);
    expect(updates('a@b.eu', '')).toBe(false);
    expect(updates('', '1')).toBe(false);
  });

  it('ignores file uploads in text fields', () => {
    const data = form(valid);
    data.set('name', new Blob(['Alex Example']), 'name.txt');
    expect(parseSignature(data)).toEqual({ ok: false, error: 'invalid_name' });
  });
});

describe('readLang', () => {
  it('returns a known language', () => expect(readLang(form({ lang: 'lt' }))).toBe('lt'));
  it.each(['', 'xx', 'EN', '../en', 'en-GB'])('falls back to English for %j', (lang) => {
    expect(readLang(form({ lang }))).toBe('en');
  });
});
