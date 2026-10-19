#!/usr/bin/env sh
# Build command for Cloudflare Pages (pnpm build:pages).
#
# On the production branch, pending D1 migrations are applied before the build, so new
# code never goes live before the tables it needs. If a migration fails, the build fails
# and nothing is deployed. Preview branches only build: they must never change the
# production database.
#
# Needs CLOUDFLARE_API_TOKEN (D1 Edit only) and CLOUDFLARE_ACCOUNT_ID in the Pages
# build variables. Wrangler skips migrations that have already run.
set -eu

if [ "${CF_PAGES_BRANCH:-}" = "main" ]; then
  pnpm db:migrate:remote
fi

pnpm build
