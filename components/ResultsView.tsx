'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, ChevronLeft, ChevronRight, Dices } from 'lucide-react';
import type { FilterState, Movie } from '@/lib/types';
import { defaultFilters } from '@/lib/types';
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

  useEffect(() => {
    setResultsOffset(0);
  }, [results]);

  const start = resultsOffset * RESULTS_PAGE_SIZE;
  useEffect(() => {
    if (results.length > 0 && start >= results.length) setResultsOffset(0);
  }, [results.length, start]);

  const displayed = results.slice(start, start + RESULTS_PAGE_SIZE);
  const hasOsarFilter = filters.oscarFilter !== 'any';
  const hasSecondaryFilter = filters.genre.length > 0 || filters.decade.length > 0 || filters.runtime != null;
  const shouldShowMatchPercent = !hasOsarFilter || hasSecondaryFilter;
  const hasNext = start + RESULTS_PAGE_SIZE < results.length;
  const hasPrevious = resultsOffset > 0;
  const pageLabel =
    results.length === 0
      ? ''
      : results.length <= RESULTS_PAGE_SIZE
        ? `1–${results.length}`
        : `${start + 1}–${Math.min(start + RESULTS_PAGE_SIZE, results.length)} of ${results.length}`;

  return (
    <div className="min-h-screen bg-cherry-950 relative">
      <SparkleBackground currentStep={5} />
      <div className="sticky top-0 left-0 right-0 z-30 bg-cherry-950">
        <header className="border-b border-brass/40 py-3 px-4 sm:py-4 sm:px-6">
          <div className="w-full grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className="flex justify-center min-w-0">
              <button
                type="button"
                onClick={onBackToWizard}
                className="flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-sm border-2 border-brass/50 text-brass-light hover:border-brass hover:bg-brass/10 transition-all touch-manipulation text-sm font-medium"
              >
                <Home className="w-3.5 h-3.5" />
                Home
              </button>
            </div>
            <div className="flex justify-center shrink-0">
              <MarqueeLogo text="CINEMATCH" />
            </div>
            <div className="flex justify-center min-w-0">
              {onSurpriseMe && (
                <button
                  type="button"
                  onClick={onSurpriseMe}
                  disabled={rollingDice || loading}
                  className="flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-sm border-2 border-brass/50 text-brass-light hover:border-brass hover:bg-brass/10 transition-all touch-manipulation disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium"
                  title="Surprise Me (Chaos Mode)"
                >
                  <Dices className={`w-3.5 h-3.5 ${rollingDice ? 'animate-pulse' : ''}`} aria-hidden />
                  <span>{rollingDice ? 'Rolling the dice…' : 'Surprise Me'}</span>
                </button>
              )}
            </div>
          </div>
        </header>
        <div className="h-1 bg-cherry-900">
          <div className="h-full w-full bg-brass" aria-hidden />
        </div>
      </div>

      {error && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 relative z-10">
          <div className="rounded-xl border-2 border-amber-500/50 bg-cherry-900 p-4">
            <p className="text-amber-400 font-medium">Couldn’t load matches</p>
            <p className="text-antique text-sm mt-1">{error}</p>
            <p className="text-antique/90 text-sm mt-2">Check TMDB_API_KEY in .env.local and try again.</p>
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-4 pb-8 sm:pt-5 sm:pb-10 relative z-10">
        <div
          className={`transition-all duration-300 ${isSlateOpen ? 'blur-sm pointer-events-none select-none' : ''}`}
        >
          {loading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center min-h-[50vh] py-24"
            >
              <VintageFilmReel className="w-24 h-24 sm:w-28 sm:h-28 mb-6" aria-hidden />
              <p className="text-antique text-sm film-leader-pulse text-center">
                Pulling reel data from TMDB…
              </p>
            </motion.div>
          ) : results.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20 border-2 border-brass/50 rounded-xl bg-cherry-950 overflow-hidden"
            >
              <div className="rounded-lg p-8 bg-cherry-900 mx-auto max-w-md">
                <p className="text-cream text-lg">No movies found.</p>
                <p className="text-cream/80 text-sm mt-2">
                  Try different filters, use Surprise Me, or open the Director&apos;s Slate to loosen filters.
                </p>
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center w-full">
              <p className="text-cream text-sm text-center mb-4 max-w-md">
                Ranked from best match onward. Your top picks are listed first.
              </p>
              <div className="w-full max-w-4xl flex justify-end pr-2 mb-1.5">
                <div className="flex items-center gap-1.5 flex-nowrap">
                  <span className="text-cream text-sm tabular-nums">{pageLabel}</span>
                  <button
                    type="button"
                    onClick={() => setResultsOffset((o) => Math.max(0, o - 1))}
                    disabled={!hasPrevious}
                    className="p-1.5 rounded-sm border-2 border-brass/50 text-brass-light hover:border-brass hover:bg-brass/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all touch-manipulation"
                    title="Previous page"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setResultsOffset((o) => o + 1)}
                    disabled={!hasNext}
                    className="p-1.5 rounded-sm border-2 border-brass/50 text-brass-light hover:border-brass hover:bg-brass/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all touch-manipulation"
                    title="Next page"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="w-full max-w-4xl rounded-xl border-2 border-brass/50 overflow-hidden bg-cherry-900 shadow-lg">
                <div className="p-4 sm:p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                    {displayed.map((movie, i) => {
                      const globalIdx = start + i;
                      const matchPercent =
                        movie.rating >= 0.5
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
          )}
        </div>

        <AnimatePresence>
          {isSlateOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-40"
              aria-live="polite"
            >
              <p className="text-neon-gold text-xl font-display font-semibold text-neon-glow">
                Recalculating…
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <DirectorsConsole
        filters={filters}
        onUpdate={onUpdateFilters}
        onOpenChange={setIsSlateOpen}
        onRefresh={onRefresh}
        onClearSelections={() => onUpdateFilters(defaultFilters)}
      />
    </div>
  );
}
