#!/usr/bin/env node
/**
 * daily-sync-tmdb-catalog.mjs
 *
 * Efficient daily update for the Supabase `movies` catalog:
 *   1. New TMDB IDs from today's export (not yet in DB)
 *   2. Re-sync recent releases that are stale (votes/posters/streaming change)
 *
 * Typical run: a few hundred to low thousands of API calls (~5–30 min).
 *
 * Usage:
 *   node scripts/daily-sync-tmdb-catalog.mjs
 *   node scripts/daily-sync-tmdb-catalog.mjs --max-new=500 --max-refresh=300
 *
 * Env (.env.local): TMDB_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import {
  loadEnv,
  requireEnv,
  createSupabase,
  createRateLimiter,
  fmtMs,
  totalSkipped,
  openLatestExportStream,
  loadExistingIds,
  collectNewIdsFromExport,
  loadStaleRecentReleaseIds,
  processMovieIds,
  NEW_RELEASES_WINDOW_DAYS,
  isoDateDaysAgo,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW,
} from './lib/tmdb-catalog-sync.mjs';

loadEnv();
const { TMDB_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = requireEnv();
const supabase = createSupabase(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const rateLimiter = createRateLimiter();

function parseArgs(argv) {
  const opts = {
    maxNew: 2_000,
    maxRefresh: 600,
    refreshStaleDays: 7,
    newIdLookback: 25_000,
    progressEvery: 50,
  };
  for (const arg of argv) {
    if (arg.startsWith('--max-new=')) opts.maxNew = Math.max(0, parseInt(arg.slice(10), 10) || opts.maxNew);
    if (arg.startsWith('--max-refresh=')) opts.maxRefresh = Math.max(0, parseInt(arg.slice(14), 10) || opts.maxRefresh);
    if (arg.startsWith('--refresh-stale-days=')) {
      opts.refreshStaleDays = Math.max(1, parseInt(arg.slice(21), 10) || opts.refreshStaleDays);
    }
    if (arg.startsWith('--new-id-lookback=')) {
      opts.newIdLookback = Math.max(0, parseInt(arg.slice(18), 10) || opts.newIdLookback);
    }
  }
  return opts;
}

function buildWorkQueue(newIds, refreshIds, maxNew, maxRefresh) {
  // Higher TMDB ids are usually newer titles — prioritize for the daily cap.
  const sortedNew = [...newIds].sort((a, b) => b - a).slice(0, maxNew);
  const refreshSet = new Set(refreshIds.slice(0, maxRefresh));
  for (const id of sortedNew) refreshSet.delete(id);
  const queue = [...sortedNew, ...refreshSet];
  return { queue, newFetchCount: sortedNew.length, refreshCount: refreshSet.size };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  console.log('╔══════════════════════════════════════════════╗');
  console.log('║     GOODREELS — TMDB Daily Catalog Sync      ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  const { stream: exportStream, exportDateStr } = await openLatestExportStream();

  const { data: runRow, error: runErr } = await supabase
    .from('sync_runs')
    .insert({
      run_type: 'daily_sync',
      export_date: exportDateStr,
      status: 'running',
      meta: opts,
    })
    .select('id')
    .single();
  if (runErr) throw new Error('Failed to create sync_run: ' + runErr.message);
  const runId = runRow.id;

  console.log(`Sync run ID     : ${runId}`);
  console.log(`Export date     : ${exportDateStr}`);
  console.log(`Max new fetches : ${opts.maxNew.toLocaleString()}`);
  console.log(`Max refreshes   : ${opts.maxRefresh.toLocaleString()}`);
  console.log(`Refresh if older: ${opts.refreshStaleDays} days\n`);

  const { ids: existingIds, maxId: maxExistingId } = await loadExistingIds(supabase);
  const minNewId = Math.max(0, maxExistingId - opts.newIdLookback);

  console.log(`Scanning export for new IDs (tmdb_id >= ${minNewId.toLocaleString()})...`);
  const { stats: exportStats, newIds } = await collectNewIdsFromExport(
    exportStream,
    existingIds,
    minNewId,
  );

  const releaseSince = isoDateDaysAgo(NEW_RELEASES_WINDOW_DAYS);
  const syncedBefore = new Date(Date.now() - opts.refreshStaleDays * 86_400_000).toISOString();

  console.log(`Loading stale recent releases (since ${releaseSince}, synced before ${syncedBefore.slice(0, 10)})...`);
  const refreshIds = await loadStaleRecentReleaseIds(supabase, {
    releaseSince,
    syncedBefore,
    maxRows: opts.maxRefresh,
  });

  const { queue, newFetchCount, refreshCount } = buildWorkQueue(
    newIds,
    refreshIds,
    opts.maxNew,
    opts.maxRefresh,
  );

  console.log('\nDaily sync plan:');
  console.log(`  Export lines       : ${exportStats.seen.toLocaleString()}`);
  console.log(`  Below ID cutoff    : ${(exportStats.belowMinId ?? 0).toLocaleString()} (skipped — bulk-seed backlog)`);
  console.log(`  New in export      : ${exportStats.queued.toLocaleString()} (will fetch up to ${newFetchCount.toLocaleString()})`);
  console.log(`  Stale recent in DB : ${refreshIds.length.toLocaleString()} (refreshing ${refreshCount.toLocaleString()})`);
  console.log(`  Total API calls    : ${queue.length.toLocaleString()}`);

  if (queue.length === 0) {
    await supabase
      .from('sync_runs')
      .update({
        status: 'completed',
        finished_at: new Date().toISOString(),
        ids_seen: exportStats.seen,
        ids_queued: 0,
        ids_fetched: 0,
        ids_upserted: 0,
        ids_skipped: 0,
        meta: { ...opts, message: 'nothing_to_sync' },
      })
      .eq('id', runId);
    console.log('\nNothing to sync — catalog is up to date.\n');
    return;
  }

  const estSecs = queue.length * (RATE_LIMIT_WINDOW / RATE_LIMIT_MAX / 1000);
  console.log(`  Est. runtime       : ~${fmtMs(estSecs * 1000)}\n`);

  await supabase
    .from('sync_runs')
    .update({
      ids_seen: exportStats.seen,
      ids_queued: queue.length,
      meta: { ...opts, export_new: exportStats.queued, planned_new: newFetchCount, planned_refresh: refreshCount },
    })
    .eq('id', runId);

  console.log('Fetching + upserting...\n');

  const total = queue.length;
  const stats = await processMovieIds({
    supabase,
    tmdbApiKey: TMDB_API_KEY,
    rateLimiter,
    ids: queue,
    exportDateStr,
    progressEvery: opts.progressEvery,
    onProgress(s) {
      const pct = ((s.fetched / total) * 100).toFixed(1);
      const elapsed = Date.now() - s.startedAt;
      const rate = elapsed > 0 ? (s.fetched / elapsed) * 1000 : 0;
      const remain = s.fetched > 0 ? ((total - s.fetched) / rate) * 1000 : 0;
      console.log(
        `[${new Date().toISOString().slice(11, 19)}] ${pct}% | ` +
          `fetched=${s.fetched.toLocaleString()}/${total.toLocaleString()} ` +
          `upserted=${s.upserted.toLocaleString()} skipped=${totalSkipped(s).toLocaleString()} ` +
          `rate=${rate.toFixed(2)}/s ETA=${fmtMs(remain)}`,
      );
    },
  });

  const skipped = totalSkipped(stats);
  await supabase
    .from('sync_runs')
    .update({
      status: 'completed',
      finished_at: new Date().toISOString(),
      ids_seen: exportStats.seen,
      ids_queued: queue.length,
      ids_fetched: stats.fetched,
      ids_upserted: stats.upserted,
      ids_skipped: skipped,
      meta: {
        ...opts,
        export_new: exportStats.queued,
        planned_new: newFetchCount,
        planned_refresh: refreshCount,
        skip_breakdown: stats.skipped,
      },
    })
    .eq('id', runId);

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║           DAILY SYNC COMPLETE                ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  New IDs in export : ${String(exportStats.queued).padStart(12)}           ║`);
  console.log(`║  Planned new fetch : ${String(newFetchCount).padStart(12)}           ║`);
  console.log(`║  Planned refresh   : ${String(refreshCount).padStart(12)}           ║`);
  console.log(`║  Fetched           : ${String(stats.fetched).padStart(12)}           ║`);
  console.log(`║  Upserted          : ${String(stats.upserted).padStart(12)}           ║`);
  console.log(`║  Skipped (total)   : ${String(skipped).padStart(12)}           ║`);
  console.log(`║  Elapsed           : ${fmtMs(Date.now() - stats.startedAt).padStart(12)}           ║`);
  console.log('╚══════════════════════════════════════════════╝\n');
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
