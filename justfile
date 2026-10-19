# European Public Order Initiative — common tasks. Run `just` to list them.

db := "public-order-eu"

# List available recipes
default:
    @just --list

# Install dependencies and prepare local development
setup:
    pnpm install
    test -f .dev.vars || cp .dev.vars.example .dev.vars
    pnpm db:migrate:local

# Astro dev server on http://localhost:4321, with the API and local D1 behind /api
dev:
    #!/usr/bin/env bash
    trap 'kill 0' EXIT
    pnpm --silent dev:api &
    pnpm dev

# Build and run the full site with the API and local D1 on http://localhost:8788
preview:
    pnpm preview

# Build the static site into dist/
build:
    pnpm build

# Type-check the site and the Functions, then the translations
check:
    pnpm check
    pnpm i18n:check

# Unit tests (validation, hashing, headers, Turnstile)
test:
    pnpm test

# Browser tests against a local site, API and database (CHROMIUM_PATH=/usr/bin/chromium for a system browser)
e2e *args:
    pnpm build
    pnpm exec playwright test {{args}}

# Translation report, optionally for some languages: just i18n de fr
i18n *langs:
    pnpm i18n:check {{langs}}

# Build and deploy to Cloudflare Pages
deploy: check
    pnpm run deploy

# Apply database migrations (just migrate remote, for production)
migrate target="local":
    pnpm wrangler d1 migrations apply {{db}} --{{target}}

# Run SQL against the database: just sql "SELECT COUNT(*) FROM signatures" [remote]
sql query target="local":
    pnpm wrangler d1 execute {{db}} --{{target}} --command "{{query}}"

# Current counter and signature totals
stats target="local":
    pnpm wrangler d1 execute {{db}} --{{target}} --command "SELECT key, value FROM stats; SELECT verified, COUNT(*) AS signatures FROM signatures GROUP BY verified;"

# Verified signatures per country
countries target="local":
    pnpm wrangler d1 execute {{db}} --{{target}} --command "SELECT country, COUNT(*) AS signatures FROM signatures WHERE verified = 1 GROUP BY country ORDER BY signatures DESC;"

# Signatures sent without Turnstile, waiting for review
pending target="local":
    pnpm wrangler d1 execute {{db}} --{{target}} --command "SELECT id, name, country, created_at FROM signatures WHERE verified = 0 ORDER BY id;"

# Reset the counter to the real number of verified signatures
recount target="local":
    pnpm wrangler d1 execute {{db}} --{{target}} --command "UPDATE stats SET value = (SELECT COUNT(*) FROM signatures WHERE verified = 1) WHERE key = 'verified_count';"

# Add fake verified signatures to the LOCAL database, to see the counter: just fake-signatures 5000
fake-signatures count="1234":
    pnpm wrangler d1 execute {{db}} --local --command "WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < {{count}}) INSERT INTO signatures (name, country, lang, verified, delete_hash) SELECT 'Fake signer ' || i, substr('ATBEBGHRCYCZDKEEFIFRDEGRHUIEITLVLTLUMTNLPLPTROSKSIESSE', 1 + 2 * (abs(random()) % 27), 2), 'en', 1, 'fake-' || lower(hex(randomblob(16))) FROM n; UPDATE stats SET value = (SELECT COUNT(*) FROM signatures WHERE verified = 1) WHERE key = 'verified_count'; SELECT value AS counter FROM stats WHERE key = 'verified_count';"

# Remove the fake signatures from the LOCAL database again
clear-fake-signatures:
    pnpm wrangler d1 execute {{db}} --local --command "DELETE FROM signatures WHERE delete_hash LIKE 'fake-%'; UPDATE stats SET value = (SELECT COUNT(*) FROM signatures WHERE verified = 1) WHERE key = 'verified_count'; SELECT value AS counter FROM stats WHERE key = 'verified_count';"

# Find a signature by e-mail (needs HASH_SALT in the environment): just find-email a@b.eu remote
find-email email target="local":
    pnpm wrangler d1 execute {{db}} --{{target}} --command "SELECT id, name, country, verified, created_at FROM signatures WHERE email_hash = '$(pnpm --silent hash-email '{{email}}')';"

# Stop update e-mails for an address (keeps the signature): just unsubscribe a@b.eu remote
unsubscribe email target="local":
    pnpm wrangler d1 execute {{db}} --{{target}} --command "UPDATE signatures SET wants_updates = 0, email = NULL WHERE email = lower('{{email}}'); SELECT changes() AS unsubscribed;"

# Addresses of people who asked for updates: just mailing-list remote
mailing-list target="local":
    pnpm wrangler d1 execute {{db}} --{{target}} --command "SELECT email, lang FROM signatures WHERE wants_updates = 1 AND email IS NOT NULL ORDER BY lang, id;"

# Re-render the press kit and the Open Graph image (needs rsvg-convert and uv)
brand:
    pnpm brand
