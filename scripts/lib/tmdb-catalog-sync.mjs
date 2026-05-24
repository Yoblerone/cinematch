/**
 * Shared TMDB → Supabase catalog sync utilities (seed + daily sync).
 */

import { createClient } from '@supabase/supabase-js';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';
import http from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, '../..');

export const TMDB_BASE = 'https://api.themoviedb.org/3';
export const RATE_LIMIT_MAX = 40;
export const RATE_LIMIT_WINDOW = 10_000;
export const UPSERT_BATCH_SIZE = 40;
export const EXISTING_PAGE_SIZE = 1_000;

/** Align with lib/era.ts NEW_RELEASES_WINDOW_DAYS */
export const NEW_RELEASES_WINDOW_DAYS = 180;

/** Load `.env.local` when present (local dev). CI passes secrets via `process.env` — no file needed. */
export function loadEnv() {
  const envPath = join(ROOT, '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && !(key in process.env)) process.env[key] = val;
  }
}

export function requireEnv() {
  const TMDB_API_KEY = process.env.TMDB_API_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!TMDB_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing env: TMDB_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  }
  return { TMDB_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY };
}

export function createSupabase(url, serviceRoleKey) {
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function fmtMs(ms) {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.round((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

export function exportDateParts(d = new Date()) {
  return {
    mm: String(d.getUTCMonth() + 1).padStart(2, '0'),
    dd: String(d.getUTCDate()).padStart(2, '0'),
    yyyy: String(d.getUTCFullYear()),
  };
}

export function exportUrl({ mm, dd, yyyy }) {
  return `http://files.tmdb.org/p/exports/movie_ids_${mm}_${dd}_${yyyy}.json.gz`;
}

export function isoDateDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function createRateLimiter() {
  const timestamps = [];
  return {
    async throttle() {
      const now = Date.now();
      while (timestamps.length && now - timestamps[0] >= RATE_LIMIT_WINDOW) timestamps.shift();
      if (timestamps.length >= RATE_LIMIT_MAX) {
        const waitMs = RATE_LIMIT_WINDOW - (now - timestamps[0]) + 5;
        await sleep(waitMs);
        return this.throttle();
      }
      timestamps.push(Date.now());
    },
  };
}

function httpGetStream(url, hops = 0) {
  return new Promise((resolve, reject) => {
    if (hops > 5) return reject(new Error('Too many redirects: ' + url));
    const proto = url.startsWith('https') ? https : http;
    proto
      .get(url, (res) => {
        if ([301, 302, 307, 308].includes(res.statusCode)) {
          res.destroy();
          return resolve(httpGetStream(res.headers.location, hops + 1));
        }
        if (res.statusCode !== 200) {
          res.destroy();
          const err = new Error(`HTTP ${res.statusCode} — ${url}`);
          err.statusCode = res.statusCode;
          return reject(err);
        }
        resolve(res);
      })
      .on('error', reject);
  });
}

/** Resolve latest TMDB daily export stream (today → 3 days back). */
export async function openLatestExportStream() {
  const datesToTry = [0, 1, 2, 3].map((daysBack) =>
    exportDateParts(new Date(Date.now() - daysBack * 86_400_000)),
  );

  for (const parts of datesToTry) {
    const url = exportUrl(parts);
    try {
      console.log(`Trying export: movie_ids_${parts.mm}_${parts.dd}_${parts.yyyy}.json.gz ...`);
      const stream = await httpGetStream(url);
      const exportDateStr = `${parts.yyyy}-${parts.mm}-${parts.dd}`;
      console.log('Found.\n');
      return { stream, exportDateStr };
    } catch (e) {
      if (e.statusCode === 403 || e.statusCode === 404) {
        console.log(`Not available (HTTP ${e.statusCode}), trying previous day...`);
        continue;
      }
      throw e;
    }
  }
  throw new Error('Could not find a TMDB export file (tried last 4 days).');
}

function extractTrailerKey(videos) {
  const results = videos?.results ?? [];
  const t = results.find(
    (v) =>
      (v.site ?? '').toLowerCase() === 'youtube' &&
      (v.type ?? '').toLowerCase() === 'trailer',
  );
  return t?.key?.trim() || null;
}

export function qualityGate(data) {
  if (data.adult) return 'adult';
  if (data.video) return 'video';
  if (!data.poster_path) return 'no_poster';
  if (!(data.overview ?? '').trim()) return 'no_overview';
  if ((data.vote_count ?? 0) < 10) return 'low_votes';
  return null;
}

export function mapToRow(data, exportDateStr) {
  const genres = data.genres ?? [];
  const keywords = data.keywords?.keywords ?? [];
  const providers = (data['watch/providers'] ?? data.watch_providers)?.results ?? {};

  return {
    tmdb_id: data.id,
    title: data.title ?? '',
    original_title: data.original_title ?? null,
    overview: (data.overview ?? '').trim(),
    tagline: data.tagline?.trim() || null,
    release_date: data.release_date || null,
    runtime_minutes: data.runtime || null,
    original_language: data.original_language || null,
    status: data.status || null,
    adult: data.adult ?? false,
    video: data.video ?? false,
    vote_average: typeof data.vote_average === 'number' ? data.vote_average : 0,
    vote_count: typeof data.vote_count === 'number' ? data.vote_count : 0,
    popularity: typeof data.popularity === 'number' ? data.popularity : 0,
    budget: data.budget ?? 0,
    revenue: data.revenue ?? 0,
    collection_id: data.belongs_to_collection?.id ?? null,
    collection_name: data.belongs_to_collection?.name ?? null,
    poster_path: data.poster_path ?? null,
    backdrop_path: data.backdrop_path ?? null,
    imdb_id: data.imdb_id ?? null,
    trailer_youtube_key: extractTrailerKey(data.videos),
    genre_ids: genres.map((g) => g.id),
    genre_names: genres.map((g) => g.name),
    keyword_ids: keywords.map((k) => k.id),
    keyword_names: keywords.map((k) => k.name),
    credits: {
      cast: (data.credits?.cast ?? [])
        .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
        .slice(0, 20)
        .map(({ id, name, popularity, order }) => ({ id, name, popularity, order })),
      crew: (data.credits?.crew ?? [])
        .filter((c) => ['Director', 'Writer', 'Screenplay', 'Story'].includes(c.job))
        .map(({ id, name, job, popularity }) => ({ id, name, job, popularity })),
    },
    watch_providers: providers,
    videos: { results: data.videos?.results ?? [] },
    belongs_to_collection: data.belongs_to_collection ?? null,
    custom_tags: {},
    export_seen_at: exportDateStr,
    last_synced_at: new Date().toISOString(),
    sync_source: 'tmdb',
  };
}

export async function fetchMovieDetail(tmdbApiKey, rateLimiter, tmdbId) {
  const url =
    `${TMDB_BASE}/movie/${tmdbId}` +
    `?api_key=${tmdbApiKey}` +
    `&append_to_response=credits,watch%2Fproviders,keywords,videos`;

  for (let attempt = 0; attempt < 3; attempt++) {
    await rateLimiter.throttle();
    let res;
    try {
      res = await fetch(url);
    } catch (networkErr) {
      if (attempt === 2) throw networkErr;
      await sleep(3_000 * (attempt + 1));
      continue;
    }

    if (res.status === 404) return null;
    if (res.status === 401) {
      throw new Error('TMDB 401 Unauthorized — check TMDB_API_KEY');
    }
    if (res.status === 429) {
      const wait = parseInt(res.headers.get('retry-after') || '10', 10) * 1000;
      console.warn(`  [429] Rate limited — waiting ${wait / 1000}s`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) {
      if (attempt === 2) throw new Error(`TMDB ${res.status} for /movie/${tmdbId}`);
      await sleep(2_000 * (attempt + 1));
      continue;
    }
    return await res.json();
  }
  return null;
}

/**
 * Stream export; returns stats + IDs not in `existingIds` (adult/video pre-filtered).
 * @param {number|null} minTmdbId — when set (daily sync), ignore older export IDs already skipped by bulk seed
 */
export async function collectNewIdsFromExport(exportStream, existingIds, minTmdbId = null) {
  const gunzip = createGunzip();
  const rl = createInterface({ input: exportStream.pipe(gunzip), crlfDelay: Infinity });

  const stats = { seen: 0, adult: 0, video: 0, exists: 0, queued: 0 };
  const newIds = [];

  for await (const line of rl) {
    if (!line.trim()) continue;
    stats.seen++;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    if (entry.adult) {
      stats.adult++;
      continue;
    }
    if (entry.video) {
      stats.video++;
      continue;
    }
    if (existingIds.has(entry.id)) {
      stats.exists++;
      continue;
    }
    if (minTmdbId != null && entry.id < minTmdbId) {
      stats.belowMinId = (stats.belowMinId ?? 0) + 1;
      continue;
    }

    newIds.push(entry.id);
    stats.queued++;
  }

  return { stats, newIds };
}

export async function loadExistingIds(supabase) {
  const ids = new Set();
  let maxId = 0;
  let page = 0;
  process.stdout.write('Loading existing movie IDs from Supabase');
  while (true) {
    const { data, error } = await supabase
      .from('movies')
      .select('tmdb_id')
      .range(page * EXISTING_PAGE_SIZE, (page + 1) * EXISTING_PAGE_SIZE - 1);
    if (error) throw new Error('Failed to load existing IDs: ' + error.message);
    if (!data || data.length === 0) break;
    for (const r of data) {
      ids.add(r.tmdb_id);
      if (r.tmdb_id > maxId) maxId = r.tmdb_id;
    }
    if (data.length < EXISTING_PAGE_SIZE) break;
    page++;
    if (page % 10 === 0) process.stdout.write('.');
  }
  console.log(` done. ${ids.size.toLocaleString()} in DB (max tmdb_id ${maxId.toLocaleString()}).\n`);
  return { ids, maxId };
}

/**
 * Recent releases in DB that should be re-fetched (votes/posters mature over time).
 */
export async function loadStaleRecentReleaseIds(supabase, {
  releaseSince,
  syncedBefore,
  maxRows,
}) {
  const ids = [];
  let page = 0;

  while (ids.length < maxRows) {
    const from = page * EXISTING_PAGE_SIZE;
    const to = from + EXISTING_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('movies')
      .select('tmdb_id, release_date, last_synced_at')
      .gte('release_date', releaseSince)
      .lt('last_synced_at', syncedBefore)
      .order('release_date', { ascending: false })
      .range(from, to);

    if (error) throw new Error('Failed to load stale recent releases: ' + error.message);
    if (!data || data.length === 0) break;

    for (const row of data) {
      if (ids.length >= maxRows) break;
      ids.push(row.tmdb_id);
    }
    if (data.length < EXISTING_PAGE_SIZE) break;
    page++;
  }

  return ids;
}

export async function processMovieIds({
  supabase,
  tmdbApiKey,
  rateLimiter,
  ids,
  exportDateStr,
  progressEvery = 100,
  onProgress,
}) {
  const stats = {
    fetched: 0,
    upserted: 0,
    refreshed: 0,
    skipped: { no_poster: 0, no_overview: 0, low_votes: 0, error: 0 },
    startedAt: Date.now(),
  };

  let upsertBuffer = [];

  async function flushBuffer(force = false) {
    if (upsertBuffer.length === 0) return;
    if (!force && upsertBuffer.length < UPSERT_BATCH_SIZE) return;
    const batch = upsertBuffer.splice(0, UPSERT_BATCH_SIZE);
    const { error } = await supabase.from('movies').upsert(batch, { onConflict: 'tmdb_id' });
    if (error) {
      console.error(`  [UPSERT ERROR] ${error.message}`);
      stats.skipped.error += batch.length;
    } else {
      stats.upserted += batch.length;
    }
  }

  for (const tmdbId of ids) {
    try {
      const data = await fetchMovieDetail(tmdbApiKey, rateLimiter, tmdbId);
      stats.fetched++;

      if (!data) {
        stats.skipped.error++;
      } else {
        const failReason = qualityGate(data);
        if (failReason) {
          if (failReason in stats.skipped) stats.skipped[failReason]++;
        } else {
          upsertBuffer.push(mapToRow(data, exportDateStr));
          await flushBuffer();
        }
      }
    } catch (err) {
      console.error(`  [ERROR] tmdb_id=${tmdbId}: ${err.message}`);
      stats.skipped.error++;
    }

    if (onProgress && stats.fetched % progressEvery === 0) {
      onProgress(stats);
    }
  }

  while (upsertBuffer.length > 0) await flushBuffer(true);
  return stats;
}

export function totalSkipped(stats) {
  return Object.values(stats.skipped).reduce((a, b) => a + b, 0);
}
