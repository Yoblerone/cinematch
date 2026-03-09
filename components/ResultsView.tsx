'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, ChevronLeft, ChevronRight } from 'lucide-react';
import type { FilterState, Movie } from '@/lib/types';
import MovieCard from './MovieCard';
import DirectorsConsole from './DirectorsConsole';
import SparkleBackground from './SparkleBackground';
import MarqueeLogo from './MarqueeLogo';

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
}

export default function ResultsView({
  filters,
  onUpdateFilters,
  onBackToWizard,
  results,
  loading,
  error,
  onRefresh,
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
      <header className="sticky top-0 left-0 right-0 border-b border-brass/40 py-3 px-4 sm:py-4 sm:px-6 z-30 bg-cherry-950">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-3 relative">
          <div className="flex-1 min-w-0 flex items-center">
            <button
              type="button"
              onClick={onBackToWizard}
              className="flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-lg border-2 border-brass/50 text-brass-light hover:border-brass hover:bg-brass/10 transition-all touch-manipulation"
            >
              <Home className="w-4 h-4" />
              Home
            </button>
          </div>
          <MarqueeLogo text="CINEMATCH" />
          <div className="flex-1 min-w-0 flex items-center justify-end gap-1.5 flex-shrink-0 flex-wrap">
            {results.length > 0 && (
              <>
                <span className="text-cream text-sm tabular-nums mr-1">{pageLabel}</span>
                <button
                  type="button"
                  onClick={() => setResultsOffset((o) => Math.max(0, o - 1))}
                  disabled={!hasPrevious}
                  className="p-2 rounded-lg border border-brass/50 text-brass-light hover:border-brass hover:bg-brass/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all touch-manipulation"
                  title="Previous page"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setResultsOffset((o) => o + 1)}
                  disabled={!hasNext}
                  className="p-2 rounded-lg border border-brass/50 text-brass-light hover:border-brass hover:bg-brass/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all touch-manipulation"
                  title="Next page"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
            {results.length === 0 && !loading && !error && (
              <span className="text-cream text-sm">0 films</span>
            )}
          </div>
        </div>
      </header>
      <div className="h-1 bg-cherry-900 relative z-10">
        <div className="h-full w-full bg-brass" aria-hidden />
      </div>

      {error && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 relative z-10">
          <div className="rounded-xl border-2 border-amber-500/50 bg-cherry-900 p-4">
            <p className="text-amber-400 font-medium">Couldn’t load matches</p>
            <p className="text-cream text-sm mt-1">{error}</p>
            <p className="text-cream/80 text-sm mt-2">Check TMDB_API_KEY in .env.local and try again.</p>
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
              className="text-center py-24 border-2 border-brass/50 rounded-xl bg-cherry-950"
            >
              <p className="text-neon-gold text-xl font-display font-semibold text-neon-glow">
                Finding your matches…
              </p>
              <p className="text-cream text-sm mt-2">Using real data from TMDB</p>
            </motion.div>
          ) : results.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20 border-2 border-brass/50 rounded-xl bg-cherry-950 overflow-hidden"
            >
              <div className="rounded-lg p-8 bg-cherry-900 mx-auto max-w-md">
                <p className="text-cream text-lg">No matches for this combination.</p>
                <p className="text-cream/80 text-sm mt-2">
                  Open the Director&apos;s Slate to loosen your filters.
                </p>
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center w-full">
              <p className="text-cream text-sm text-center mb-4 max-w-md">
                Ranked from best match onward. Your top picks are listed first.
              </p>
              <div className="w-full max-w-4xl rounded-xl border-2 border-brass/50 overflow-hidden bg-cherry-900 shadow-lg">
                <div className="p-4 sm:p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                    {displayed.map((movie, i) => (
                      <MovieCard
                        key={movie.id}
                        movie={movie}
                        index={start + i}
                        variant="compact"
                      />
                    ))}
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
      />
    </div>
  );
}
