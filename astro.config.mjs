// @ts-check
import { defineConfig } from "astro/config";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

const SITE = "https://public-order.eu";
/** Where `pnpm dev:api` runs the Functions during development. */
const API_DEV_ORIGIN = "http://localhost:8788";

// Keep in sync with src/i18n/locales.ts (astro.config cannot import TS sources).
const locales = [
  "en",
  "fr",
  "de",
  "nl",
  "es",
  "it",
  "pt",
  "pl",
  "da",
  "sv",
  "no",
  "fi",
  "et",
  "lv",
  "lt",
];

/** Locales whose UI dictionary is marked `"_status": "complete"`. */
const completeLocales = new Set(
  readdirSync("./src/i18n/ui")
    .filter((f) => f.endsWith(".json"))
    .filter(
      (f) =>
        JSON.parse(readFileSync(`./src/i18n/ui/${f}`, "utf8"))._status ===
        "complete",
    )
    .map((f) => f.replace(".json", "")),
);

const CONTENT_PAGES = ["petition", "privacy", "legal"];
const NOINDEX_PAGES = ["thanks", "delete"];

/**
 * Only list pages in the sitemap that are actually translated, so search engines
 * don't index English fallback copies under /fr/, /de/, etc.
 */
/** @param {string} page */
function includeInSitemap(page) {
  const [lang, slug = ""] = new URL(page).pathname.split("/").filter(Boolean);
  if (!lang) return false; // "/" is just a language redirect
  if (!completeLocales.has(lang)) return false;
  if (NOINDEX_PAGES.includes(slug)) return false;
  if (CONTENT_PAGES.includes(slug))
    return existsSync(`./src/content/pages/${lang}/${slug}.md`);
  if (slug === "faq") return existsSync(`./src/content/faq/${lang}.yaml`);
  return true;
}

/**
 * `astro dev` serves pages only. During development, /api/* is forwarded to the
 * Pages Functions run by `pnpm dev:api` (wrangler pages dev with the local D1);
 * `just dev` starts both. Not Vite's `server.proxy`: Astro puts its own checks
 * (trailing slash, route guard) at the front of the middleware stack, and they
 * would answer /api/count with a 404. This plugin runs after Astro's and puts
 * itself in front of them. (Typed by hand: `vite` is not a direct dependency.)
 */
function devApiProxy() {
  return {
    name: "dev-api-proxy",
    apply: "serve",
    enforce: "post",
    /** @param {{ middlewares: { stack: object[] } }} server */
    configureServer(server) {
      return () =>
        server.middlewares.stack.unshift({
          route: "",
          /**
           * @param {import('node:http').IncomingMessage} req
           * @param {import('node:http').ServerResponse} res
           * @param {() => void} next
           */
          handle: async (req, res, next) => {
            if (!req.url?.startsWith("/api/")) return next();
            const headers = new Headers();
            for (const [key, value] of Object.entries(req.headers)) {
              if (value === undefined || ["host", "connection"].includes(key))
                continue;
              headers.set(key, Array.isArray(value) ? value.join(", ") : value);
            }
            // The Functions only accept form posts from their own origin.
            if (headers.has("origin")) headers.set("origin", API_DEV_ORIGIN);
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            try {
              const upstream = await fetch(API_DEV_ORIGIN + req.url, {
                method: req.method,
                headers,
                body: chunks.length ? Buffer.concat(chunks) : undefined,
                redirect: "manual",
              });
              res.statusCode = upstream.status;
              upstream.headers.forEach((value, key) => {
                // fetch() has already decoded the body.
                if (
                  ![
                    "content-encoding",
                    "content-length",
                    "transfer-encoding",
                  ].includes(key)
                )
                  res.setHeader(key, value);
              });
              res.end(Buffer.from(await upstream.arrayBuffer()));
            } catch {
              res.statusCode = 503;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  error:
                    "API not running: start it with `pnpm dev:api`, or use `just dev`",
                }),
              );
            }
          },
        });
    },
  };
}

export default defineConfig({
  site: SITE,
  output: "static",
  trailingSlash: "always",
  i18n: {
    locales,
    defaultLocale: "en",
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false,
    },
  },
  integrations: [
    sitemap({
      filter: includeInSitemap,
      i18n: {
        defaultLocale: "en",
        locales: Object.fromEntries(locales.map((l) => [l, l])),
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss(), devApiProxy()],
  },
});
