/**
 * GET /api/count — the number of verified signatures, as { count }.
 * Cached at the edge for 60 seconds so page views don't hit the database.
 * (siteConfig.countOffset is added client-side.)
 */
import type { Env } from '../../server/env';
import { json } from '../../server/http';

const MAX_AGE = 60;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const cache = caches.default;
  const cacheKey = new Request(new URL('/api/count', request.url).href, { method: 'GET' });

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  let count = 0;
  try {
    const row = await env.DB.prepare(`SELECT value FROM stats WHERE key = 'verified_count'`).first<{ value: number }>();
    count = row?.value ?? 0;
  } catch (err) {
    console.error('count: database error', err);
    return json({ count: null }, 503, { 'Cache-Control': 'no-store' });
  }

  const response = json({ count }, 200, { 'Cache-Control': `public, max-age=${MAX_AGE}` });
  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
};
