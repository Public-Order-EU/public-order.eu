/**
 * Read-only access to the local D1 database of the test server, to check what
 * was really stored. (/api/count is cached for 60 s, so the counter is read here.)
 */
import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { E2E } from './config.mjs';

export interface SignatureRow {
  id: number;
  name: string;
  country: string;
  email: string | null;
  email_hash: string | null;
  wants_updates: number;
  lang: string;
  verified: number;
  delete_hash: string;
  created_at: string;
}

function file(): string {
  const dir = join(E2E.persistDir, 'v3/d1/miniflare-D1DatabaseObject');
  const name = readdirSync(dir).find((f) => f.endsWith('.sqlite') && f !== 'metadata.sqlite');
  if (!name) throw new Error(`No D1 database in ${dir}`);
  return join(dir, name);
}

/** Opens the database for each query, so every read sees the latest writes. */
function all<T>(sql: string, ...params: (string | number)[]): T[] {
  const db = new DatabaseSync(file(), { readOnly: true });
  try {
    return db.prepare(sql).all(...params) as T[];
  } finally {
    db.close();
  }
}

export const emailHash = (email: string) =>
  createHash('sha256').update(`${E2E.salt}:email:${email.trim().toLowerCase()}`).digest('hex');

export const signaturesByName = (name: string) => all<SignatureRow>('SELECT * FROM signatures WHERE name = ?', name);

export const counter = () => all<{ value: number }>(`SELECT value FROM stats WHERE key = 'verified_count'`)[0].value;

export const verifiedTotal = () => all<{ n: number }>('SELECT COUNT(*) AS n FROM signatures WHERE verified = 1')[0].n;

export const columns = () => all<{ name: string }>('PRAGMA table_info(signatures)').map((c) => c.name);
