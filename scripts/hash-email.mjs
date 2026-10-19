#!/usr/bin/env node
/**
 * Prints the salted hash of an e-mail address, to find a signature when
 * someone asks for deletion without their withdrawal code.
 *
 *   HASH_SALT='…production salt…' pnpm hash-email person@example.org
 *
 * Must match hashEmail() in server/crypto.ts. Then, in D1:
 *   SELECT id, name, country, created_at FROM signatures WHERE email_hash = '<hash>';
 */
import { createHash } from 'node:crypto';

const salt = process.env.HASH_SALT;
const email = (process.argv[2] || '').trim().toLowerCase();
if (!salt || !email) {
  console.error("Usage: HASH_SALT='…' pnpm hash-email person@example.org");
  process.exit(1);
}
console.log(createHash('sha256').update(`${salt}:email:${email}`).digest('hex'));
