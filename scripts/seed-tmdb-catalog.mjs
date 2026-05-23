#!/usr/bin/env node
/**
 * seed-tmdb-catalog.mjs
 *
 * Bulk seeds the Supabase `movies` table from TMDB's daily export.
 * Streams the full export (900k+ IDs), pre-filters adult/video entries,
 * then fetches each remaining ID from TMDB with a single enriched call.
 *
 * Usage:
 *   node scripts/seed-tmdb-catalog.mjs
 *   node scripts/seed-tmdb-catalog.mjs --resume
 *
 * Reads env vars from .env.local:
 *   TMDB_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Rate limit: 40 requests / 10 seconds (TMDB free tier).
 * Estimated runtime for full catalog: 14–30 hours depending on network.
 * Use --resume to continue an interrupted run.
 */

import { createClient }  from '@supabase/supabase-js';
import { createGunzip }  from 'node:zlib';
import { createInterface } from 'node:readline';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';
import http  from 'node:http';

// ── Paths ────────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Load .env.local ──────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = join(ROOT, '.env.local');
  if (!existsSync(envPath)) throw new Error('.env.local not found at ' + envPath);
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

loadEnv();

const TMDB_API_KEY            = process.env.TMDB_API_KEY;
const SUPABASE_URL            = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!TMDB_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env vars. Need: TMDB_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// ── Constants ────────────────────────────────────────────────────────────────

const TMDB_BASE           = 'https://api.themoviedb.org/3';
const RATE_LIMIT_MAX      = 40;    // requests
const RATE_LIMIT_WINDOW   = 10_000; // ms
const UPSERT_BATCH_SIZE   = 40;    // rows per Supabase upsert
const PROGRESS_EVERY      = 200;   // log every N fetches
const DB_SYNC_EVERY       = 1_000; // persist progress to sync_runs every N fetches
const EXISTING_PAGE_SIZE  = 1_000; // rows per page when loading existing IDs

// ── Supabase client (service role — bypasses RLS) ────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── Rate limiter (sliding window) ────────────────────────────────────────────

const rateLimiter = (() => {
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
})();

// ── Helpers ──────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

function fmtMs(ms) {
  if (ms < 60_000)     return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000)  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.round((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

function exportDateParts(d = new Date()) {
  return {
    mm:   String(d.getUTCMonth() + 1).padStart(2, '0'),
    dd:   String(d.getUTCDate()).padStart(2, '0'),
    yyyy: String(d.getUTCFullYear()),
  };
}

function exportUrl({ mm, dd, yyyy }) {
  return `http://files.tmdb.org/p/exports/movie_ids_${mm}_${dd}_${yyyy}.json.gz`;
}

function extractTrailerKey(videos) {
  const results = videos?.results ?? [];
  const t = results.find(v =>
    (v.site ?? '').toLowerCase() === 'youtube' &&
    (v.type ?? '').toLowerCase() === 'trailer'
  );
  return t?.key?.trim() || null;
}

// ── HTTP GET with redirect following (returns Node.js IncomingMessage stream) ─

function httpGetStream(url, hops = 0) {
  return new Promise((resolve, reject) => {
    if (hops > 5) return reject(new Error('Too many redirects: ' + url));
    const proto = url.startsWith('https') ? https : http;
    proto.get(url, res => {
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
    }).on('error', reject);
  });
}

// ── TMDB fetch (one call per movie with all appended data) ───────────────────

async function fetchMovieDetail(tmdbId) {
  const url =
    `${TMDB_BASE}/movie/${tmdbId}` +
    `?api_key=${TMDB_API_KEY}` +
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

    if (res.status === 404) return null;        // deleted / not found
    if (res.status === 401) {
      console.error('TMDB 401 Unauthorized — check TMDB_API_KEY');
      process.exit(1);
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

// ── Quality gate (applied after fetch) ──────────────────────────────────────

function qualityGate(data) {
  if (data.adult)                       return 'adult';
  if (data.video)                       return 'video';
  if (!data.poster_path)                return 'no_poster';
  if (!(data.overview ?? '').trim())    return 'no_overview';
  if ((data.vote_count ?? 0) < 10)      return 'low_votes';
  return null; // passes
}

// ── Map TMDB detail response → Supabase movies row ──────────────────────────

function mapToRow(data, exportDateStr) {
  const genres   = data.genres ?? [];
  const keywords = data.keywords?.keywords ?? [];
  // watch/providers is appended — response key contains the literal slash
  const providers = (data['watch/providers'] ?? data.watch_providers)?.results ?? {};

  return {
    tmdb_id:          data.id,
    title:            data.title ?? '',
    original_title:   data.original_title ?? null,
    overview:         (data.overview ?? '').trim(),
    tagline:          data.tagline?.trim() || null,
    release_date:     data.release_date || null,
    runtime_minutes:  data.runtime || null,
    original_language: data.original_language || null,
    status:           data.status || null,
    adult:            data.adult ?? false,
    video:            data.video ?? false,
    vote_average:     typeof data.vote_average === 'number' ? data.vote_average : 0,
    vote_count:       typeof data.vote_count   === 'number' ? data.vote_count   : 0,
    popularity:       typeof data.popularity   === 'number' ? data.popularity   : 0,
    budget:           data.budget  ?? 0,
    revenue:          data.revenue ?? 0,
    collection_id:    data.belongs_to_collection?.id   ?? null,
    collection_name:  data.belongs_to_collection?.name ?? null,
    poster_path:      data.poster_path   ?? null,
    backdrop_path:    data.backdrop_path ?? null,
    imdb_id:          data.imdb_id ?? null,
    trailer_youtube_key: extractTrailerKey(data.videos),
    genre_ids:    genres.map(g => g.id),
    genre_names:  genres.map(g => g.name),
    keyword_ids:  keywords.map(k => k.id),
    keyword_names: keywords.map(k => k.name),
    // Keep top 20 cast + director/writer crew (bounds row size)
    credits: {
      cast: (data.credits?.cast ?? [])
        .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
        .slice(0, 20)
        .map(({ id, name, popularity, order }) => ({ id, name, popularity, order })),
      crew: (data.credits?.crew ?? [])
        .filter(c => ['Director', 'Writer', 'Screenplay', 'Story'].includes(c.job))
        .map(({ id, name, job, popularity }) => ({ id, name, job, popularity })),
    },
    watch_providers:      providers,
    videos:               { results: data.videos?.results ?? [] },
    belongs_to_collection: data.belongs_to_collection ?? null,
    custom_tags:          {},
    export_seen_at:       exportDateStr,
    last_synced_at:       new Date().toISOString(),
    sync_source:          'tmdb',
  };
}

// ── Load existing tmdb_ids from DB (for resume / skip logic) ─────────────────

async function loadExistingIds() {
  const ids = new Set();
  let page = 0;
  process.stdout.write('Loading existing movie IDs from Supabase');
  while (true) {
    const { data, error } = await supabase
      .from('movies')
      .select('tmdb_id')
      .range(page * EXISTING_PAGE_SIZE, (page + 1) * EXISTING_PAGE_SIZE - 1);
    if (error) throw new Error('Failed to load existing IDs: ' + error.message);
    if (!data || data.length === 0) break;
    for (const r of data) ids.add(r.tmdb_id);
    if (data.length < EXISTING_PAGE_SIZE) break;
    page++;
    if (page % 10 === 0) process.stdout.write('.');
  }
  console.log(` done. ${ids.size.toLocaleString()} already in DB.\n`);
  return ids;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args       = process.argv.slice(2);
  const resumeMode = args.includes('--resume');

  console.log('╔══════════════════════════════════════════════╗');
  console.log('║       GOODREELS — TMDB Bulk Seed             ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  // ── Resolve export file (today → yesterday fallback) ─────────────────────
  let exportStream, exportDateStr;
  const today     = exportDateParts(new Date());
  const yesterday = exportDateParts(new Date(Date.now() - 86_400_000));

  // Try up to 3 days back — TMDB export files are generated ~8 AM UTC,
  // so at midnight UTC today's file may not exist yet (returns 403 or 404).
  const datesToTry = [today, yesterday];
  const twoDaysAgo = exportDateParts(new Date(Date.now() - 2 * 86_400_000));
  datesToTry.push(twoDaysAgo);

  for (const parts of datesToTry) {
    const url = exportUrl(parts);
    try {
      console.log(`Trying export: movie_ids_${parts.mm}_${parts.dd}_${parts.yyyy}.json.gz ...`);
      exportStream   = await httpGetStream(url);
      exportDateStr  = `${parts.yyyy}-${parts.mm}-${parts.dd}`;
      console.log(`Found.\n`);
      break;
    } catch (e) {
      // 403 or 404 both mean "not available yet" — try the previous day
      if (e.statusCode === 403 || e.statusCode === 404) {
        console.log(`Not available (HTTP ${e.statusCode}), trying previous day...`);
        continue;
      }
      throw e;
    }
  }
  if (!exportStream) throw new Error('Could not find a TMDB export file (tried today and yesterday).');

  // ── Create sync_runs record ───────────────────────────────────────────────
  const { data: runRow, error: runErr } = await supabase
    .from('sync_runs')
    .insert({ run_type: 'bulk_seed', export_date: exportDateStr, status: 'running', meta: { args } })
    .select('id')
    .single();
  if (runErr) throw new Error('Failed to create sync_run: ' + runErr.message);
  const runId = runRow.id;
  console.log(`Sync run ID : ${runId}`);
  console.log(`Export date : ${exportDateStr}`);
  console.log(`Resume mode : ${resumeMode}\n`);

  // ── Load existing IDs (skip these during stream) ──────────────────────────
  const existingIds = await loadExistingIds();

  // ── Stream & parse the gzip export, collect qualifying IDs ───────────────
  console.log('Streaming TMDB export and collecting IDs to fetch...');
  const idsToFetch = [];
  const preStats   = { seen: 0, adult: 0, video: 0, exists: 0, queued: 0 };

  const gunzip = createGunzip();
  const rl     = createInterface({ input: exportStream.pipe(gunzip), crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    preStats.seen++;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }

    if (entry.adult) { preStats.adult++;  continue; }
    if (entry.video) { preStats.video++;  continue; }
    if (existingIds.has(entry.id)) { preStats.exists++; continue; }

    idsToFetch.push(entry.id);
    preStats.queued++;
  }

  console.log(`\nExport parsed:`);
  console.log(`  Total lines    : ${preStats.seen.toLocaleString()}`);
  console.log(`  Pre-skip adult : ${preStats.adult.toLocaleString()}`);
  console.log(`  Pre-skip video : ${preStats.video.toLocaleString()}`);
  console.log(`  Already in DB  : ${preStats.exists.toLocaleString()}`);
  console.log(`  To fetch       : ${preStats.queued.toLocaleString()}`);

  const estSecs = preStats.queued * (RATE_LIMIT_WINDOW / RATE_LIMIT_MAX / 1000);
  console.log(`  Est. runtime   : ~${fmtMs(estSecs * 1000)} at full rate limit\n`);

  await supabase.from('sync_runs').update({ ids_seen: preStats.seen, ids_queued: preStats.queued }).eq('id', runId);

  // ── Fetch + upsert loop ───────────────────────────────────────────────────
  const stats = {
    fetched:  0,
    upserted: 0,
    skipped:  { no_poster: 0, no_overview: 0, low_votes: 0, error: 0 },
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

  function printProgress() {
    const elapsed = Date.now() - stats.startedAt;
    const rate    = elapsed > 0 ? (stats.fetched / elapsed * 1000).toFixed(2) : '0.00';
    const pct     = ((stats.fetched / preStats.queued) * 100).toFixed(1);
    const remain  = stats.fetched > 0
      ? ((preStats.queued - stats.fetched) / (stats.fetched / elapsed)) : 0;
    const totalSkipped = Object.values(stats.skipped).reduce((a, b) => a + b, 0);
    console.log(
      `[${new Date().toISOString().slice(11, 19)}] ` +
      `${pct}% | fetched=${stats.fetched.toLocaleString()}/${preStats.queued.toLocaleString()} ` +
      `upserted=${stats.upserted.toLocaleString()} skipped=${totalSkipped.toLocaleString()} ` +
      `rate=${rate}/s ETA=${fmtMs(remain)}`
    );
  }

  console.log('Starting fetch + upsert loop...\n');

  for (const tmdbId of idsToFetch) {
    try {
      const data = await fetchMovieDetail(tmdbId);
      stats.fetched++;

      if (!data) {
        stats.skipped.error++;
      } else {
        const failReason = qualityGate(data);
        if (failReason) {
          if (failReason in stats.skipped) stats.skipped[failReason]++;
          // adult/video shouldn't appear here (pre-filtered), but handle defensively
        } else {
          upsertBuffer.push(mapToRow(data, exportDateStr));
          await flushBuffer();
        }
      }
    } catch (err) {
      console.error(`  [ERROR] tmdb_id=${tmdbId}: ${err.message}`);
      stats.skipped.error++;
    }

    if (stats.fetched % PROGRESS_EVERY === 0) {
      printProgress();
    }

    if (stats.fetched % DB_SYNC_EVERY === 0) {
      const totalSkipped = Object.values(stats.skipped).reduce((a, b) => a + b, 0);
      await supabase.from('sync_runs').update({
        ids_fetched:  stats.fetched,
        ids_upserted: stats.upserted,
        ids_skipped:  totalSkipped,
        cursor_tmdb_id: tmdbId,
      }).eq('id', runId);
    }
  }

  // Flush remainder
  while (upsertBuffer.length > 0) await flushBuffer(true);

  // ── Final report ──────────────────────────────────────────────────────────
  const totalSkipped = Object.values(stats.skipped).reduce((a, b) => a + b, 0);
  await supabase.from('sync_runs').update({
    status:       'completed',
    finished_at:  new Date().toISOString(),
    ids_seen:     preStats.seen,
    ids_queued:   preStats.queued,
    ids_fetched:  stats.fetched,
    ids_upserted: stats.upserted,
    ids_skipped:  totalSkipped,
  }).eq('id', runId);

  printProgress();
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║              SEED COMPLETE                   ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  Export lines   : ${preStats.seen.toLocaleString().padStart(12)} (total in file) ║`);
  console.log(`║  Pre-skip adult : ${preStats.adult.toLocaleString().padStart(12)}                ║`);
  console.log(`║  Pre-skip video : ${preStats.video.toLocaleString().padStart(12)}                ║`);
  console.log(`║  Already in DB  : ${preStats.exists.toLocaleString().padStart(12)}                ║`);
  console.log(`║  Fetched        : ${stats.fetched.toLocaleString().padStart(12)}                ║`);
  console.log(`║  Upserted       : ${stats.upserted.toLocaleString().padStart(12)}                ║`);
  console.log(`║  Skip no poster : ${stats.skipped.no_poster.toLocaleString().padStart(12)}                ║`);
  console.log(`║  Skip no overv. : ${stats.skipped.no_overview.toLocaleString().padStart(12)}                ║`);
  console.log(`║  Skip <10 votes : ${stats.skipped.low_votes.toLocaleString().padStart(12)}                ║`);
  console.log(`║  Errors         : ${stats.skipped.error.toLocaleString().padStart(12)}                ║`);
  console.log(`║  Elapsed        : ${fmtMs(Date.now() - stats.startedAt).padStart(12)}                ║`);
  console.log('╚══════════════════════════════════════════════╝');
}

// ── Graceful shutdown ────────────────────────────────────────────────────────

process.on('SIGINT', () => {
  console.log('\n\nInterrupted. Run with --resume to continue from where you left off.');
  process.exit(0);
});

main().catch(err => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
