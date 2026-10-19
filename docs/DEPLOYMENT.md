# Deployment — Cloudflare Pages

This guide sets up public-order.eu on Cloudflare Pages with a D1 database and Turnstile.
Everything fits within Cloudflare's free plans for a typical petition.

You need a Cloudflare account, with both domains (`public-order.eu` and `publicorder.eu`)
added as zones, Node 22+ and pnpm installed locally. Run `pnpm wrangler login` once.

## 1. Create the database

Create it in the **EU jurisdiction** so the signatures are stored in the EU:

```sh
pnpm wrangler d1 create public-order-eu --jurisdiction eu
```

Paste the returned `database_id` into `wrangler.toml`. The production build creates the
tables (see step 3). To apply the migrations by hand instead:

```sh
pnpm db:migrate:remote
```

## 2. Create the Turnstile widget

In the Cloudflare dashboard, open **Turnstile → Add widget**:

- **Hostnames:** `public-order.eu` (and `localhost` if you want to test with real keys).
- **Widget mode:** *Managed*. The form uses `interaction-only`, so most visitors never see it.

Keep the **site key** (public) and the **secret key**.

## 3. Create the Pages project

Go to **Workers & Pages → Create → Pages → Connect to Git** and choose this repository.

Make sure you pick the **Pages** tab. The default flow creates a *Worker*, which runs
`npx wrangler deploy` and fails with "Missing entry-point to Worker script or to assets
directory". If that happened, delete the Worker and create a Pages project instead.

| Setting | Value |
| --- | --- |
| Framework preset | Astro |
| Build command | `pnpm build:pages` |
| Build output directory | `dist` |
| Environment variable (build) | `PUBLIC_TURNSTILE_SITE_KEY` = your Turnstile site key |
| Environment variable | `PNPM_VERSION` = `11.3.0` (same as `packageManager` in `package.json`) |
| Secret | `CLOUDFLARE_API_TOKEN` = an API token that can only edit D1 (see below) |
| Environment variable | `CLOUDFLARE_ACCOUNT_ID` = your account ID |

Pages detects pnpm from `pnpm-lock.yaml`. Its default pnpm version is older and cannot
read this lockfile, which is why `PNPM_VERSION` is needed. The Node version comes from
`.node-version` in the repository, so no `NODE_VERSION` variable is needed. Use the
latest build system version (**Settings → Build**); older ones cannot install it.

`pnpm build:pages` (`scripts/pages-build.sh`) applies pending D1 migrations before it
builds, but only on the `main` branch: preview branches never touch the production
database. If a migration fails, the build fails and nothing is deployed. Create the
token under **My Profile → API Tokens → Create Token → Custom token** with the single
permission **Account → D1 → Edit**, limited to this account. Add the token and the
account ID to the **Production** environment only, so preview builds never get them. The
account ID is on the account's overview page.

Pages reads the D1 binding and `[vars]` from `wrangler.toml`. Check that the binding
`DB` appears under **Settings → Bindings** after the first deploy.

The project name must be `public-order-eu` (as in `wrangler.toml`), or the D1 binding and
the `noindex` rule for `*.pages.dev` in `public/_headers` will not match. If you choose a
different name, update both.

## 4. Set the secrets

```sh
pnpm wrangler pages secret put TURNSTILE_SECRET_KEY   # Turnstile secret key
pnpm wrangler pages secret put HASH_SALT              # see below
```

Generate the salt with `openssl rand -base64 48`.

> **Never change `HASH_SALT` after launch.** E-mail hashes (duplicate detection) and
> withdrawal-code hashes depend on it. A new salt means no withdrawal code works any
> more and the same address can sign again. Store a copy in your password manager. It is
> also needed to run `pnpm hash-email`.

Also set the secrets for the **Preview** environment if you use preview deployments. You
can use the Turnstile test secret `1x0000000000000000000000000000000AA` there.

Redeploy after you set the secrets, so they take effect.

## 5. Domains

### Primary domain

Under **Pages project → Custom domains**, add `public-order.eu` and `www.public-order.eu`.
Cloudflare creates the DNS records.

Then add a 301 from `www` to the apex. In the `public-order.eu` zone, go to
**Rules → Redirect Rules → Create rule**:

- **When:** Hostname equals `www.public-order.eu`
- **Then:** Dynamic redirect, expression `concat("https://public-order.eu", http.request.uri.path)`,
  status **301**, *preserve query string* on.

### Secondary domain → 301

In the `publicorder.eu` zone:

1. Add proxied DNS records (orange cloud) so Cloudflare receives the traffic. The target
   does not matter:
   - `A  @    192.0.2.1`
   - `A  www  192.0.2.1`
2. Go to **Rules → Redirect Rules → Create rule**:
   - **When:** Hostname is in `{publicorder.eu www.publicorder.eu}`
   - **Then:** Dynamic redirect, expression `concat("https://public-order.eu", http.request.uri.path)`,
     status **301**, *preserve query string* on.

Test it: `curl -sI https://publicorder.eu/fr/faq/` should return `301` with
`location: https://public-order.eu/fr/faq/`.

### SSL/TLS

In both zones:
- set SSL/TLS to **Full (strict)**;
- turn on **Always Use HTTPS**.

The site already sends `Strict-Transport-Security` without `preload`. Add `preload`, and
submit the domain to hstspreload.org, only once you are sure every subdomain will always
serve HTTPS. Preloading is very hard to undo.

## 6. Abuse protection

Turnstile, the honeypot field, the same-origin check and the unique e-mail hash stop most
abuse. Add a rate limit as well. In the `public-order.eu` zone, go to **Security → WAF →
Rate limiting rules**:

- **When:** URI Path starts with `/api/sign` **or** starts with `/api/delete`, and Request Method equals `POST`
- **Rate:** 10 requests per 1 minute per IP
- **Action:** Block for 10 minutes

The free plan allows one rule, which is enough here. Cloudflare's own rate limiting does
not change what the site stores, so no IP addresses reach the database.

### Keep the "no cookies" promise

The privacy policy says the site sets **no cookies**. Some Cloudflare security features set
cookies of their own. Leave them off for the `public-order.eu` zone:

- **Bot Fight Mode** and **Super Bot Fight Mode** (Security → Bots) set `__cf_bm`;
- **WAF rules with a Managed or JS Challenge action** set `cf_clearance`. Use *Block* for
  the rate-limiting rule, as above.

Turnstile does not need either. If you ever turn one of them on, update section 8 of the
privacy policy first. The e2e tests check that the site itself sets no cookies, but they
cannot see Cloudflare's zone settings.

## 7. Deploy

Push to the production branch. Pages builds and deploys automatically. Then check:

- `https://public-order.eu/` redirects to a language;
- signing works and the thanks page shows a withdrawal code;
- the code works on `/en/delete/`;
- `https://public-order.eu/api/count` returns `{"count":…}`;
- your `*.pages.dev` address sends `X-Robots-Tag: noindex`.

Manual deploys are also possible with `pnpm run deploy`. The build reads the site key from
`.env` (see `.env.example`).

## Costs

These figures use Cloudflare's published pricing as of 2026. Check
[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) and
[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) before relying on them.

| Item | Free plan | Paid (Workers Paid, $5/month) |
| --- | --- | --- |
| Static pages and assets | Unlimited, free | Unlimited, free |
| Functions (`/`, `/api/*`) | 100,000 requests/day | 10M/month included, then $0.30 per million |
| D1 rows written | 100,000/day | 50M/month included, then $1 per million |
| D1 rows read | 5M/day | 25 billion/month included |
| D1 storage | 5 GB | 5 GB included, then $0.75/GB-month |
| Turnstile | Free | Free |
| Pages builds | 500/month | 5,000/month |

What one signature uses:
- **1 Function request** (`/api/sign`).
- **About 6 D1 rows written:** the row and its indexes, plus the counter.
- **About 0.5 KB of storage.**

Each visit also makes Function requests that aren't signatures: one for `/api/count` on
the home page, and one for the language redirect when someone opens `/`.

**For 10,000 signatures:**
- about 60,000 rows written and 5 MB of storage;
- 10,000 signing requests, plus, at a guess of 5 visitors per signer, about 100,000
  counter and redirect requests.

That fits in the free plan unless most of it lands on a single day. If a campaign goes
viral, the free daily limit of 100,000 Function requests is the first one you would hit.
Signing and the live counter would stop working until midnight UTC, while the static
pages would keep working. To avoid that, switch to Workers Paid before a big push.

At paid rates, 1 million signatures would cost about $5 to $8 in total, so the monthly
fee is effectively the whole cost.

Fixed costs outside Cloudflare's usage pricing:
- the two `.eu` domains, roughly €5 to €15 a year each;
- the contact mailboxes. Cloudflare Email Routing can forward `contact@`, `privacy@` and
  `press@` to existing inboxes for free.

## Useful SQL

The `just stats`, `countries`, `pending`, `recount`, `find-email` and `sql` recipes cover
most of these queries. Pass `remote` as the last argument to query production.

Run these with `pnpm wrangler d1 execute public-order-eu --remote --command "…"`.
Add `--local` instead of `--remote` to work on the local database.

**Recount the counter** (if it ever drifts):

```sql
UPDATE stats SET value = (SELECT COUNT(*) FROM signatures WHERE verified = 1)
 WHERE key = 'verified_count';
```

**Review signatures sent without Turnstile** (visitors without JavaScript):

```sql
SELECT id, name, country, created_at FROM signatures WHERE verified = 0 ORDER BY id;

-- Accept the ones that look genuine (adjust the id list), then recount (above):
UPDATE signatures SET verified = 1 WHERE verified = 0 AND id IN (12, 15, 19);

-- Delete obvious spam:
DELETE FROM signatures WHERE verified = 0 AND id IN (13, 14);
```

**Totals per country**, for the hand-over:

```sql
SELECT country, COUNT(*) AS signatures FROM signatures WHERE verified = 1
 GROUP BY country ORDER BY signatures DESC;
```

**Full export** of verified names and countries (only if needed for the hand-over; keep
the file secure and delete it afterwards):

```sh
pnpm wrangler d1 execute public-order-eu --remote --json \
  --command "SELECT name, country, created_at FROM signatures WHERE verified = 1 ORDER BY id" > export.json
```

**Mailing list** (only people who asked for updates):

```sql
SELECT email, lang FROM signatures WHERE wants_updates = 1 AND email IS NOT NULL;
```

**Backups:** D1 Time Travel can restore the database to any point in the last 30 days
(`pnpm wrangler d1 time-travel info public-order-eu`). Remember that restoring brings back
signatures that were withdrawn since then. Delete them again if you restore.

## GDPR requests

**Deletion with the code.** The signer does this themselves on `/<lang>/delete/`.

**Deletion without the code.** If the person signed with an e-mail address, and the
request comes from that address:

```sh
HASH_SALT='…production salt…' pnpm hash-email person@example.org
```

```sql
SELECT id, name, country, verified, created_at FROM signatures WHERE email_hash = '<hash>';
-- If verified = 1, decrement the counter first (or recount afterwards):
UPDATE stats SET value = MAX(0, value - 1) WHERE key = 'verified_count';
DELETE FROM signatures WHERE id = <id>;
```

Without an e-mail address, ask for the exact name, the country and the approximate date
of signing. Delete only if there is exactly one clear match.

**Access and portability (Art. 15 and 20).** Send the person their row as JSON:

```sh
pnpm wrangler d1 execute public-order-eu --remote --json --command \
  "SELECT name, country, email, wants_updates, lang, verified, created_at FROM signatures WHERE email_hash = '<hash>'"
```

Explain that the e-mail address itself is stored only if they asked for updates, and that
otherwise only its hash is kept.

**Correction (Art. 16).** For example, a misspelt name or the wrong country:

```sql
UPDATE signatures SET name = 'Corrected Name' WHERE id = <id>;
UPDATE signatures SET country = 'BE' WHERE id = <id>;
```

**Unsubscribe from updates.** The privacy policy promises that every update e-mail
explains how to unsubscribe (for example "reply with *unsubscribe*"). Handle each request
promptly. This deletes the stored address but keeps the hash, so the signature still
counts and the address cannot sign twice:

```sh
just unsubscribe person@example.org remote
```

```sql
UPDATE signatures SET wants_updates = 0, email = NULL WHERE email = 'person@example.org';
```

Always export a fresh mailing list right before sending, so that people who unsubscribed
or withdrew are not e-mailed.

**Answer within one month**, as promised in the privacy policy.

Cloudflare's data processing addendum applies automatically to customers. Keep a copy
with your records of processing (Art. 30 GDPR).

## End of the campaign

The privacy policy promises deletion **no later than six months after the hand-over**.
Keep a record of the totals per country, then:

```sql
DELETE FROM signatures;
UPDATE stats SET value = 0 WHERE key = 'verified_count';
```

After the deletion, change `fallbackCount` in `src/site.config.ts` to the final total, and
`countOffset` too if the counter should keep showing it. Then replace the form with a
"petition closed" message, or delete the D1 database.
