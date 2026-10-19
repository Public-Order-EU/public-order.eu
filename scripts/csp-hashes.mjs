#!/usr/bin/env node
/**
 * Runs after `astro build`: replaces 'unsafe-inline' in the script-src of
 * dist/_headers with the SHA-256 hashes of the inline scripts Astro wrote into
 * the pages. The browser then runs those exact scripts and nothing else inline,
 * so injected markup could not run a script even if it got onto a page.
 *
 * Styles keep 'unsafe-inline': they can't run code, and Turnstile sets inline styles.
 * The pages are static, so the hashes are the same on every deploy of the same code.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '../dist');
const headersFile = join(dist, '_headers');
const PLACEHOLDER = "script-src 'self' 'unsafe-inline'";

const htmlFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? htmlFiles(join(dir, e.name)) : e.name.endsWith('.html') ? [join(dir, e.name)] : [],
  );

// Data blocks such as JSON-LD are never executed, so they need no hash.
const executable = (attrs) => {
  const type = /\stype=["']?([^"'\s>]+)/i.exec(attrs)?.[1]?.toLowerCase();
  return !type || type === 'module' || type === 'text/javascript';
};

const hashes = new Set();
for (const file of htmlFiles(dist)) {
  const html = readFileSync(file, 'utf8');
  for (const [, attrs = '', body] of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
    if (/\ssrc=/i.test(attrs) || !executable(attrs)) continue;
    hashes.add(`'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`);
  }
}

const headers = readFileSync(headersFile, 'utf8');
const found = headers.split(PLACEHOLDER).length - 1;
if (found !== 1) {
  console.error(`csp-hashes: expected "${PLACEHOLDER}" once in dist/_headers, found it ${found} times.`);
  process.exit(1);
}
writeFileSync(headersFile, headers.replace(PLACEHOLDER, ["script-src 'self'", ...[...hashes].sort()].join(' ')));
console.log(`csp-hashes: ${hashes.size} inline script hashes written to dist/_headers.`);
