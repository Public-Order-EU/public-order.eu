# European Public Order Initiative — public-order.eu

The petition website of the European Public Order Initiative: a static, multilingual
Astro site served by Cloudflare Pages, with a small Pages Functions API that stores
signatures in Cloudflare D1 and checks them with Cloudflare Turnstile.

- **Static first.** Every page is pre-rendered HTML. The only server code is the signature
  API. The form works without JavaScript.
- **15 languages:** en, fr, de, nl, es, it, pt, pl, da, sv, no, fi, et, lv, lt. English
  is the source. Languages that are not yet translated fall back to English and say so.
- **Minimal data.** We collect a name, a country and an optional e-mail address. We do
  not store IP addresses or use tracking cookies. Signers can withdraw their signature
  themselves with a one-time code.

## Quick start

This project uses **pnpm** (version pinned in `package.json`) and, optionally,
**[just](https://github.com/casey/just)** as a task runner.

```sh
just setup      # pnpm install, create .dev.vars from the example, local D1 migrations
just dev        # Astro dev server with the API and local D1, http://localhost:4321
just preview    # build + the site as deployed, with API and local D1, http://localhost:8788
```

Without just:

```sh
pnpm install
cp .dev.vars.example .dev.vars     # local secrets (Turnstile test key, hash salt)
pnpm db:migrate:local              # create the local D1 database
pnpm dev:api                       # the Functions and local D1 on :8788 (keep it running)
pnpm dev                           # in a second terminal: http://localhost:4321
```

`dev` reloads pages and styles instantly. It serves no Functions itself: requests to
`/api/*` are forwarded to `dev:api` (if it isn't running, they answer 503 and the
counter stays hidden). `just dev` starts both. Use `preview` for a last check of the
built site, headers and redirects included.

Only `esbuild` and `workerd` are allowed to run install scripts. They are listed under
`allowBuilds` in `pnpm-workspace.yaml`.

## just recipes

Run `just` to list them all. Database recipes take `remote` as their last argument to
run against production instead of the local database.

| Recipe | What it does |
| --- | --- |
| `just check` | Type-checks, then runs the translation report |
| `just test` | Unit tests |
| `just e2e [args]` | Builds, then runs the browser tests (args go to Playwright) |
| `just i18n de fr` | Translation report for some languages |
| `just deploy` | Runs the checks, then builds and deploys |
| `just migrate [remote]` | Applies the D1 migrations |
| `just stats [remote]` | Counter value and signature totals |
| `just countries [remote]` | Verified signatures per country |
| `just pending [remote]` | Signatures without Turnstile, waiting for review |
| `just recount [remote]` | Resets the counter to the real number of verified signatures |
| `just fake-signatures [1234]` | Adds fake verified signatures to the **local** database (never remote), to see the counter |
| `just clear-fake-signatures` | Removes them again |
| `just find-email a@b.eu [remote]` | Finds a signature by e-mail (needs `HASH_SALT` in the environment) |
| `just unsubscribe a@b.eu [remote]` | Stops update e-mails for an address and deletes it (the signature stays) |
| `just mailing-list [remote]` | Lists the addresses of people who asked for updates |
| `just sql "SELECT …" [remote]` | Runs any SQL |
| `just brand` | Re-renders the press kit and the Open Graph image |

## pnpm scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Astro dev server on port 4321; `/api/*` goes to `dev:api` |
| `pnpm dev:api` | The Functions with the local D1 on port 8788 (no pages) |
| `pnpm preview` | Builds, then serves the site and the Functions on port 8788 |
| `pnpm build` | Builds the static site into `dist/` |
| `pnpm check` | Type-checks the Astro site and the Functions |
| `pnpm i18n:check [de fr]` | Translation progress report (see [docs/TRANSLATIONS.md](docs/TRANSLATIONS.md)) |
| `pnpm db:migrate:local` / `:remote` | Applies the SQL migrations in `migrations/` |
| `pnpm run deploy` | Builds and deploys with Wrangler (git deploys are usually easier) |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:e2e` | Builds, then runs the browser tests (Playwright) |
| `pnpm test:all` | Both |
| `pnpm brand` | Renders `scripts/brand/*.svg` to `public/press/` and `public/og/default.png` (needs `rsvg-convert` and [uv](https://docs.astral.sh/uv/)) |
| `pnpm hash-email a@b.eu` | Prints an e-mail hash, to find a signature without its code |

## Updating the goal and the counter

Everything that changes during the campaign is in **`src/site.config.ts`**:

```ts
signatureGoal: 100_000,   // goal shown next to the counter
countOffset: 0,           // added to the live count (e.g. paper signatures)
fallbackCount: 0,         // number shown before the live count loads / without JS
showCountFrom: 100,       // hide the number below this (only the goal is shown)
```

Commit the change and Cloudflare Pages rebuilds the site in about a minute.

The **live count** comes from `GET /api/count`, which reads a counter row in D1 and is
cached for 60 seconds. Only verified signatures (ones that passed Turnstile) are counted.
For corrections, see the SQL in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#useful-sql).

Contact addresses, the Turnstile site key, the share hashtag and the "help translate"
link are in the same file.

## Project structure

```
├── astro.config.mjs          Astro: static output, i18n routing, sitemap, Tailwind
├── wrangler.toml             Cloudflare Pages: D1 binding, public variables
├── migrations/0001_init.sql  D1 schema (signatures + counter)
├── functions/                Cloudflare Pages Functions (the API)
│   ├── index.ts              GET /  → redirect to the visitor's language
│   └── api/
│       ├── sign.ts           POST /api/sign    store a signature
│       ├── delete.ts         POST /api/delete  withdraw a signature with its code
│       └── count.ts          GET  /api/count   verified signature count
├── server/                   Code shared by the Functions
│   ├── validate.ts           form parsing and validation
│   ├── turnstile.ts          Turnstile verification
│   ├── crypto.ts             salted hashes, withdrawal codes
│   ├── http.ts               security headers, JSON/HTML responses, origin check
│   └── env.ts                bindings and variables
├── public/                   Static files copied as-is (_headers, robots.txt, favicon, og/, press/)
├── scripts/                  Translation checker, e-mail hash helper
│   └── brand/                emblem, wordmark and OG image sources + render.sh
├── tests/
│   ├── unit/                 Vitest: validation, hashing, headers, Turnstile
│   └── e2e/                  Playwright: pages, signing, withdrawal, accessibility
└── src/
    ├── site.config.ts        ← goal, counter, contacts
    ├── i18n/
    │   ├── locales.ts        list of languages, negotiation
    │   ├── ui/<lang>.json    interface strings per language
    │   ├── dictionaries.ts   merges each language over English
    │   └── utils.ts          URL helpers
    ├── content/
    │   ├── pages/<lang>/     petition.md, privacy.md, legal.md
    │   └── faq/<lang>.yaml   FAQ
    ├── components/           form, counter, key points, share buttons, header/footer…
    ├── layouts/BaseLayout.astro   <head>: SEO, Open Graph, hreflang, theme
    └── pages/
        ├── index.astro       static fallback for /  (normally handled by functions/index.ts)
        ├── 404.astro
        └── [lang]/           index, [page] (petition/privacy/legal), faq, share, press, thanks, delete
```

## Testing

```sh
pnpm test                      # unit tests, a few seconds
pnpm test:e2e                  # builds, then runs the browser tests
CHROMIUM_PATH=/usr/bin/chromium pnpm exec playwright test   # use a system browser
```

The browser tests start their own server (`tests/e2e/server.mjs`): a fresh local D1
database, the built site with the Functions through `wrangler pages dev` on port 8790,
and a mock Turnstile endpoint on port 8799. Nothing talks to Cloudflare. They cover every
page in every language, signing with and without JavaScript, duplicates, withdrawal,
the security headers, and an automated accessibility scan (axe, WCAG 2.2 AA) in light
and dark mode.

Without `CHROMIUM_PATH`, run `pnpm exec playwright install chromium` once.

## Press kit

`/<lang>/press/` has key facts, a press contact, copy-ready descriptions and the
logos. The logos are generated: edit the SVG sources in `scripts/brand/` and run
`pnpm brand`. The script turns the text into outlines, so the downloads look the same
without the fonts installed, and it writes the PNGs and the Open Graph image.

## How signing works

1. The visitor fills in the form. With JavaScript, Turnstile runs invisibly and the form
   is sent with `fetch`. Without JavaScript, it is a normal HTML form post.
2. `POST /api/sign` checks, in order: the origin, the body size, a honeypot field, the
   fields themselves, and then the Turnstile token.
3. The signature is stored. The e-mail address is kept in plain text only if the signer
   asked for updates. Otherwise only a salted hash is kept, to prevent duplicates. The
   counter is incremented in the same transaction, but only for verified signatures.
4. The signer receives a **withdrawal code** (`XXXX-XXXX-XXXX-XXXX`). Only its hash is
   stored. Entering it on `/<lang>/delete/` removes the signature immediately.

Signatures sent without a Turnstile token (usually visitors without JavaScript) are stored
as **unverified** and are not counted until you review them. Set
`ACCEPT_UNVERIFIED = "false"` in `wrangler.toml` to reject them instead.

## Further documentation

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) covers Cloudflare setup, domains, secrets,
  running the database, and GDPR requests.
- [docs/TRANSLATIONS.md](docs/TRANSLATIONS.md) explains how to translate the site.
