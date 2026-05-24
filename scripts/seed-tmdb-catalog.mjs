#!/usr/bin/env node
/**
 * seed-tmdb-catalog.mjs
 *
 * Bulk seeds the Supabase `movies` table from TMDB's daily export.
 * For ongoing updates use: node scripts/daily-sync-tmdb-catalog.mjs
 *
 * Usage:
 *   node scripts/seed-tmdb-catalog.mjs
 *   node scripts/seed-tmdb-catalog.mjs --resume
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
  processMovieIds,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW,
} from './lib/tmdb-catalog-sync.mjs';

loadEnv();
const { TMDB_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = requireEnv();
const supabase = createSupabase(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const rateLimiter = createRateLimiter();

const PROGRESS_EVERY = 200;
const DB_SYNC_EVERY = 1_000;

async function main() {
  const args = process.argv.slice(2);
  const resumeMode = args.includes('--resume');

  console.log('╔══════════════════════════════════════════════╗');
  console.log('║       GOODREELS — TMDB Bulk Seed             ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  const { stream: exportStream, exportDateStr } = await openLatestExportStream();

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

  const { ids: existingIds } = await loadExistingIds(supabase);

  console.log('Streaming TMDB export and collecting IDs to fetch...');
  const { stats: preStats, newIds: idsToFetch } = await collectNewIdsFromExport(exportStream, existingIds);

  console.log(`\nExport parsed:`);
  console.log(`  Total lines    : ${preStats.seen.toLocaleString()}`);
  console.log(`  Pre-skip adult : ${preStats.adult.toLocaleString()}`);
  console.log(`  Pre-skip video : ${preStats.video.toLocaleString()}`);
  console.log(`  Already in DB  : ${preStats.exists.toLocaleString()}`);
  console.log(`  To fetch       : ${preStats.queued.toLocaleString()}`);

  const estSecs = preStats.queued * (RATE_LIMIT_WINDOW / RATE_LIMIT_MAX / 1000);
  console.log(`  Est. runtime   : ~${fmtMs(estSecs * 1000)} at full rate limit\n`);

  await supabase.from('sync_runs').update({ ids_seen: preStats.seen, ids_queued: preStats.queued }).eq('id', runId);

  console.log('Starting fetch + upsert loop...\n');

  let lastCursor = 0;
  const stats = await processMovieIds({
    supabase,
    tmdbApiKey: TMDB_API_KEY,
    rateLimiter,
    ids: idsToFetch,
    exportDateStr,
    progressEvery: PROGRESS_EVERY,
    async onProgress(s) {
      const pct = ((s.fetched / preStats.queued) * 100).toFixed(1);
      const elapsed = Date.now() - s.startedAt;
      const rate = elapsed > 0 ? (s.fetched / elapsed) * 1000 : 0;
      const remain = s.fetched > 0 ? ((preStats.queued - s.fetched) / rate) * 1000 : 0;
      console.log(
        `[${new Date().toISOString().slice(11, 19)}] ${pct}% | ` +
          `fetched=${s.fetched.toLocaleString()}/${preStats.queued.toLocaleString()} ` +
          `upserted=${s.upserted.toLocaleString()} skipped=${totalSkipped(s).toLocaleString()} ` +
          `rate=${rate.toFixed(2)}/s ETA=${fmtMs(remain)}`,
      );

      if (s.fetched % DB_SYNC_EVERY === 0) {
        lastCursor = idsToFetch[s.fetched - 1] ?? lastCursor;
        await supabase
          .from('sync_runs')
          .update({
            ids_fetched: s.fetched,
            ids_upserted: s.upserted,
            ids_skipped: totalSkipped(s),
            cursor_tmdb_id: lastCursor,
          })
          .eq('id', runId);
      }
    },
  });

  const skipped = totalSkipped(stats);
  await supabase
    .from('sync_runs')
    .update({
      status: 'completed',
      finished_at: new Date().toISOString(),
      ids_seen: preStats.seen,
      ids_queued: preStats.queued,
      ids_fetched: stats.fetched,
      ids_upserted: stats.upserted,
      ids_skipped: skipped,
    })
    .eq('id', runId);

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

process.on('SIGINT', () => {
  console.log('\n\nInterrupted. Re-run seed with --resume or use daily-sync for incremental updates.');
  process.exit(0);
});

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
