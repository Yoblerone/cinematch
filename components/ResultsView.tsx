'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, ChevronLeft, ChevronRight, Dices, Download } from 'lucide-react';
import type { FilterState, Movie } from '@/lib/types';
import { defaultFilters } from '@/lib/types';
import { formatOriginalLanguageCsvLabel } from '@/lib/originalLanguage';
import MovieCard from './MovieCard';
import DirectorsConsole from './DirectorsConsole';
import SparkleBackground from './SparkleBackground';
import MarqueeLogo from './MarqueeLogo';

/** Vintage film reel: static flanges and hub; only the six circular windows rotate. */
function VintageFilmReel({ className }: { className?: string }) {
  const cx = 32;
  const cy = 32;
  const holeRadius = 5;
  const holeDistance = 14;
  const sixAngles = [0, 60, 120, 180, 240, 300];

  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      stroke="#F5F5DC"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx={cx} cy={cy} r="28" />
      <circle cx={cx} cy={cy} r="20" />
      <circle cx={cx} cy={cy} r="6" />
      <circle cx={cx} cy={cy} r="2" fill="#1a0608" stroke="#F5F5DC" strokeWidth="1" />
      <g className="spin-reel">
        {sixAngles.map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const x = cx + holeDistance * Math.cos(rad);
          const y = cy + holeDistance * Math.sin(rad);
          return <circle key={deg} cx={x} cy={y} r={holeRadius} fill="none" />;
        })}
      </g>
    </svg>
  );
}

/** Local pagination: 3×3 grid per page on desktop. */
const RESULTS_PAGE_SIZE = 9;

interface ResultsViewProps {
  filters: FilterState;
  onUpdateFilters: (patch: Partial<FilterState>) => void;
  onBackToWizard: () => void;
  results: Movie[];
  loading: boolean;
  error: string | null;
  /** Re-fetch results with current filters (e.g. from Director&apos;s Slate). */
  onRefresh?: () => void;
  /** Chaos Mode: random filters + random page. */
  onSurpriseMe?: () => void;
  rollingDice?: boolean;
}

/** Escape a single CSV cell value: always wraps in quotes to handle commas and special chars. */
function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function buildCsvExport(filters: FilterState, results: Movie[]): string {
  const now = new Date();
  // Use local date/time parts to avoid UTC-vs-local date shift.
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const year = now.getFullYear();
  const dateStr = `${month}/${day}/${year}`;
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const paramLines: string[] = [];
  if (filters.genre.length > 0) paramLines.push(`Genre: ${filters.genre.join(' + ')}`);
  if (filters.decade.length > 0) paramLines.push(`Decade: ${filters.decade.join(', ')}`);
  if (filters.runtime) paramLines.push(`Runtime: ${filters.runtime}`);
  const langCsv = formatOriginalLanguageCsvLabel(filters.originalLanguage);
  if (langCsv) paramLines.push(`Language: ${langCsv}`);
  if (filters.oscarFilter) paramLines.push(`Best Picture: ${filters.oscarFilter}`);
  if (filters.aListCast) paramLines.push(`A-List Cast: ${filters.aListCast}`);
  if (filters.directorProminence) paramLines.push(`Director Prominence: ${filters.directorProminence}`);
  if (filters.criticsVsFans) paramLines.push(`Critics vs Fans: ${filters.criticsVsFans}`);
  if (filters.narrative_pacing != null) paramLines.push(`Narrative Pacing: ${filters.narrative_pacing}`);
  if (filters.emotional_tone != null) paramLines.push(`Emotional Tone: ${filters.emotional_tone}`);
  if (filters.brain_power != null) paramLines.push(`Brain Power: ${filters.brain_power}`);
  if (filters.visual_style != null) paramLines.push(`Visual Style: ${filters.visual_style}`);
  if (filters.suspense_level != null) paramLines.push(`Suspense Level: ${filters.suspense_level}`);
  if (filters.world_style != null) paramLines.push(`World Style: ${filters.world_style}`);

  const paramSummary = paramLines.length > 0 ? paramLines.join(' | ') : '(none)';

  // Column A = descriptor, Column B = value (two-column layout, safe for Excel).
  const header = [
    `Cinematch Export`,
    `Date,${csvCell(dateStr)}`,
    `Time,${csvCell(timeStr)}`,
    `Search Parameters,${csvCell(paramSummary)}`,
    `Total Results,${results.length}`,
    ``,
    `Rank,Title,Year,Match %`,
  ].join('\n');

  const rows = results.map((m, i) =>
    `${i + 1},${csvCell(m.title)},${m.year ?? ''},${m.matchPercentage ?? ''}`
  );

  return `${header}\n${rows.join('\n')}`;
}

function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildCsvFilename(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `cinematch-${mm}-${dd}-${yyyy}.csv`;
}

export default function ResultsView({
  filters,
  onUpdateFilters,
  onBackToWizard,
  results,
  loading,
  error,
  onRefresh,
  onSurpriseMe,
  rollingDice = false,
}: ResultsViewProps) {
  const [isSlateOpen, setIsSlateOpen] = useState(false);
  const [resultsOffset, setResultsOffset] = useState(0);
  const skipScrollOnFirstOffset = useRef(true);
  /** Scroll target for pagination: div wrapping the 3×3 grid (inside the card). */
  const internalGridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setResultsOffset(0);
  }, [results]);

  useEffect(() => {
    if (skipScrollOnFirstOffset.current) {
      skipScrollOnFirstOffset.current = false;
      return;
    }
    internalGridRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [resultsOffset]);

  const start = resultsOffset * RESULTS_PAGE_SIZE;
  useEffect(() => {
    if (results.length > 0 && start >= results.length) setResultsOffset(0);
  }, [results.length, start]);

  const displayed = results.slice(start, start + RESULTS_PAGE_SIZE);
  const hasNext = start + RESULTS_PAGE_SIZE < results.length;
  const hasPrevious = resultsOffset > 0;
  const pageLabel =
    results.length === 0
      ? ''
      : results.length <= RESULTS_PAGE_SIZE
        ? `1–${results.length}`
        : `${start + 1}–${Math.min(start + RESULTS_PAGE_SIZE, results.length)} of ${results.length}`;

  const hasOsarFilter = filters.oscarFilter != null;
  const hasSecondaryFilter =
    filters.genre.length > 0 ||
    filters.decade.length > 0 ||
    filters.runtime != null ||
    filters.originalLanguage != null;
  const shouldShowMatchPercent = !hasOsarFilter || hasSecondaryFilter;

  const showPaginationFooter = !loading && results.length > 0;

  const showRankedIntro = !loading && results.length > 0;

  return (
    <div className="h-screen overflow-hidden flex flex-col relative w-full min-h-0 max-h-[100dvh] bg-cherry-950">
      <SparkleBackground currentStep={5} />

      {/* Top: header + optional intro — never scrolls */}
      <div className="flex-none">
        <header className="z-30 flex w-full flex-col bg-cherry-950 border-b border-brass/40 shadow-[0_4px_24px_rgba(0,0,0,0.35)]">
          <div className="py-3 px-4 sm:py-4 sm:px-6">
            <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-4">
              <div className="flex min-w-0 justify-center">
                <button
                  type="button"
                  onClick={onBackToWizard}
                  className="flex min-h-[36px] items-center gap-1.5 rounded-sm border-2 border-brass/50 px-3 py-1.5 text-sm font-medium text-brass-light transition-all hover:border-brass hover:bg-brass/10 touch-manipulation"
                  title="Home"
                >
                  <Home className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Home</span>
                </button>
              </div>
              <div className="flex shrink-0 justify-center">
                <MarqueeLogo text="CINEMATCH" />
              </div>
              <div className="flex min-w-0 justify-center">
                {onSurpriseMe && (
                  <button
                    type="button"
                    onClick={onSurpriseMe}
                    disabled={rollingDice || loading}
                    className="flex min-h-[36px] items-center gap-1.5 rounded-sm border-2 border-brass/50 px-3 py-1.5 text-sm font-medium text-brass-light transition-all hover:border-brass hover:bg-brass/10 touch-manipulation disabled:cursor-not-allowed disabled:opacity-60"
                    title="Surprise Me"
                  >
                    <Dices className={`w-3.5 h-3.5 ${rollingDice ? 'animate-pulse' : ''}`} aria-hidden />
                    <span className="hidden sm:inline">{rollingDice ? 'Rolling…' : 'Surprise Me'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="h-1 bg-cherry-900">
            <div className="h-full w-full bg-brass" aria-hidden />
          </div>
        </header>
        {showRankedIntro && (
          <div className="px-4 py-2 sm:px-6">
            <p className="text-center text-sm text-antique">
              Ranked from best match onward. Your top picks are listed first.
            </p>
          </div>
        )}
      </div>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col">
        {error && (
          <div className="w-full shrink-0 px-4 pt-4 sm:px-6">
            <div className="rounded-xl border-2 border-amber-500/50 bg-cherry-900 p-4">
              <p className="font-medium text-amber-400">Couldn’t load matches</p>
              <p className="mt-1 text-sm text-antique">{error}</p>
              {error.includes('TMDB_API_KEY') && (
                <p className="mt-2 text-sm text-antique/90">Check TMDB_API_KEY in .env.local and try again.</p>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex min-h-[40vh] flex-1 flex-col items-center justify-center py-12"
          >
            <VintageFilmReel className="mb-6 h-24 w-24 sm:h-28 sm:w-28" aria-hidden />
            <p className="film-leader-pulse text-center text-sm text-antique">Finding your matches…</p>
          </motion.div>
        ) : results.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden border-2 border-brass/50 bg-cherry-950 py-12 text-center sm:py-16"
          >
            <div className="mx-auto max-w-md rounded-lg bg-cherry-900 p-8">
              <p className="text-lg text-cream">No movies found.</p>
              <p className="mt-2 text-sm text-cream/80">
                Try different filters, use Surprise Me, or open the Director&apos;s Slate to loosen filters.
              </p>
            </div>
          </motion.div>
        ) : (
          <>
            {/* Sandwich: equal external my-12 on card vs header/footer; internal py-8 is only inside the scroll layer */}
            <div className="flex min-h-0 flex-1 flex-col px-4 sm:px-6">
              {/* flex-1 sandwich: vertical center; card uses external my-12 only (not internal py-8 on scroll) */}
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
                {/* Relative wrapper: Export button is pinned absolute -top-8 right-0, outside the card border */}
                <div className="relative mx-auto my-3 sm:my-12 flex w-full max-w-4xl min-h-0 max-h-[calc(100%-1.5rem)] sm:max-h-[calc(100%-6rem)] flex-initial flex-col">
                  {showRankedIntro && (
                    <button
                      type="button"
                      onClick={() => {
                        const csv = buildCsvExport(filters, results);
                        downloadCsv(csv, buildCsvFilename());
                      }}
                      className="absolute right-0 -top-8 flex items-center gap-1 rounded-sm border border-brass/40 px-2 py-1 text-xs text-brass-light transition-all hover:border-brass hover:bg-brass/10 touch-manipulation"
                      title="Export results to CSV"
                    >
                      <Download className="w-3 h-3" aria-hidden />
                      <span className="hidden sm:inline">Export</span>
                    </button>
                  )}
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border-2 border-brass/50 bg-cherry-900/80 shadow-lg">
                  <div
                    ref={internalGridRef}
                    className={`min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:py-8 custom-scrollbar overscroll-y-contain ${isSlateOpen ? 'blur-sm pointer-events-none select-none' : ''}`}
                  >
                    <div className="grid min-w-0 grid-cols-1 gap-3 min-[380px]:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                      {displayed.map((movie, i) => {
                        const globalIdx = start + i;
                        const matchPercent =
                          movie.matchPercentage != null
                            ? movie.matchPercentage
                            : movie.rating >= 0.5
                              ? Math.round((movie.rating / 10) * 100)
                              : Math.round(Math.min(99, Math.max(65, 96 - globalIdx * 0.4)));
                        return (
                          <MovieCard
                            key={movie.id}
                            movie={movie}
                            index={globalIdx}
                            variant="compact"
                            matchPercent={shouldShowMatchPercent ? matchPercent : undefined}
                          />
                        );
                      })}
                    </div>
                  </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <AnimatePresence>
          {isSlateOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0 z-40 flex min-h-[30vh] flex-1 items-center justify-center py-8"
              aria-live="polite"
            >
              <p className="font-display text-xl font-semibold text-neon-gold text-neon-glow">Recalculating…</p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {showPaginationFooter && (
        <footer
          className="z-[40] flex w-full flex-none flex-col border-t border-brass/40 bg-cherry-950 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgba(0,0,0,0.35)]"
          aria-label="Results pagination"
        >
          <div className="flex min-h-[3rem] items-center justify-center gap-4 px-4">
            <span className="tabular-nums text-sm text-cream" aria-live="polite">
              {pageLabel}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setResultsOffset((o) => Math.max(0, o - 1))}
                disabled={!hasPrevious}
                className="rounded-sm border-2 border-brass/50 p-2 text-brass-light transition-all hover:border-brass hover:bg-brass/10 disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation"
                title="Previous page"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setResultsOffset((o) => o + 1)}
                disabled={!hasNext}
                className="rounded-sm border-2 border-brass/50 p-2 text-brass-light transition-all hover:border-brass hover:bg-brass/10 disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation"
                title="Next page"
                aria-label="Next page"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </footer>
      )}

      <DirectorsConsole
        filters={filters}
        onUpdate={onUpdateFilters}
        onOpenChange={setIsSlateOpen}
        onRefresh={onRefresh}
        onClearSelections={() => onUpdateFilters(defaultFilters)}
        liftFabAbovePagination={!loading && results.length > 0}
      />
    </div>
  );
}
