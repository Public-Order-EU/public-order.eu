#!/usr/bin/env node
/**
 * Test server for the Playwright suite (started by playwright.config.ts).
 *
 * 1. Creates a fresh local D1 database in .wrangler/e2e and applies the migrations.
 * 2. Starts a mock Turnstile siteverify endpoint on 127.0.0.1:8799:
 *    the token "test-pass" passes, every other token fails.
 * 3. Serves the built site (dist/) with the Functions through `wrangler pages dev`.
 *
 * Nothing here talks to Cloudflare: the database is local and the Turnstile
 * script is stubbed in the browser (tests/e2e/fixtures.ts).
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { E2E } from './config.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const wrangler = join(root, 'node_modules/.bin/wrangler');

if (!existsSync(join(root, 'dist/index.html'))) {
  console.error('dist/ is missing: run `pnpm build` first (pnpm test:e2e does this for you).');
  process.exit(1);
}

rmSync(join(root, E2E.persistDir), { recursive: true, force: true });
const migrate = spawnSync(
  wrangler,
  ['d1', 'migrations', 'apply', 'public-order-eu', '--local', '--persist-to', E2E.persistDir],
  { cwd: root, stdio: 'inherit', env: { ...process.env, CI: '1' } },
);
if (migrate.status !== 0) process.exit(migrate.status ?? 1);

const mock = createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    // The body is multipart/form-data; the token is the "response" field.
    const token = /name="response"\r\n\r\n([^\r]*)/.exec(body)?.[1];
    if (token === E2E.downToken) return res.writeHead(500).end();
    const success = token === E2E.passToken;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(success ? { success } : { success, 'error-codes': ['invalid-input-response'] }));
  });
});
mock.listen(E2E.mockPort, '127.0.0.1');

const bindings = {
  HASH_SALT: E2E.salt,
  SITE_ORIGIN: E2E.origin,
  TURNSTILE_SECRET_KEY: 'e2e-secret',
  TURNSTILE_VERIFY_URL: `http://127.0.0.1:${E2E.mockPort}/siteverify`,
};
const site = spawn(
  wrangler,
  [
    'pages', 'dev', 'dist',
    '--port', String(E2E.port),
    '--persist-to', E2E.persistDir,
    '--show-interactive-dev-session=false',
    ...Object.entries(bindings).flatMap(([k, v]) => ['--binding', `${k}=${v}`]),
  ],
  { cwd: root, stdio: 'inherit', env: { ...process.env, CI: '1' } },
);

const stop = () => {
  site.kill('SIGTERM');
  mock.close();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
site.on('exit', (code) => {
  mock.close();
  process.exit(code ?? 0);
});
