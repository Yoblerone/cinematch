'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, RotateCw } from 'lucide-react';
import type { FilterState, Movie } from '@/lib/types';
import MovieCard from './MovieCard';
import DirectorsConsole from './DirectorsConsole';
import SparkleBackground from './SparkleBackground';

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

const TIER_LABELS = ['Top Picks', 'Next Best', 'Also Great'] as const;

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

  const tier1 = displayed.slice(0, 3);
  const tier2 = displayed.slice(3, 6);
  const tier3 = displayed.slice(6, 9);

  return (
    <div className="min-h-screen bg-cherry-950 relative">
      <SparkleBackground currentStep={5} />
      <header className="border-b-2 border-brass/40 py-4 px-4 sm:px-6 sticky top-0 bg-cherry-950 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBackToWizard}
            className="flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-lg border-2 border-brass/50 text-brass-light hover:border-brass hover:bg-brass/10 transition-all touch-manipulation"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Wizard
          </button>
          <h1 className="text-xl font-display font-bold text-neon-gold text-neon-glow">
            Your Matches
          </h1>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            {results.length > 0 && (
              <>
                <span className="text-cherry-600 text-sm tabular-nums">{pageLabel}</span>
                <button
                  type="button"
                  onClick={() => setResultsOffset((o) => o + 1)}
                  disabled={!hasNext}
                  className="flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg border-2 border-brass/50 text-brass-light hover:border-brass hover:bg-brass/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all touch-manipulation"
                  title="Show next 9 picks"
                >
                  <RotateCw className="w-4 h-4" />
                  Next 9
                </button>
                {hasPrevious && (
                  <button
                    type="button"
                    onClick={() => setResultsOffset(0)}
                    className="flex items-center min-h-[44px] px-3 py-2 rounded-lg border border-brass/50 text-cherry-600 text-sm hover:border-brass hover:text-brass-light transition-all touch-manipulation"
                    title="Back to top picks"
                  >
                    First 9
                  </button>
                )}
              </>
            )}
            {results.length === 0 && !loading && !error && (
              <span className="text-cherry-600 text-sm">0 films</span>
            )}
          </div>
        </div>
      </header>

      {error && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 relative z-10">
          <div className="rounded-xl border-2 border-amber-500/50 bg-amber-950/30 p-4">
            <p className="text-amber-400 font-medium">Couldn’t load matches</p>
            <p className="text-cherry-600 text-sm mt-1">{error}</p>
            <p className="text-cherry-600/80 text-sm mt-2">Check TMDB_API_KEY in .env.local and try again.</p>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 relative z-10">
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
              <p className="text-cherry-600 text-sm mt-2">Using real data from TMDB</p>
            </motion.div>
          ) : results.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20 border-2 border-brass/50 rounded-xl bg-cherry-950 overflow-hidden"
            >
              <div className="rounded-lg p-8 bg-cherry-900 mx-auto max-w-md">
                <p className="text-cherry-600 text-lg">No matches for this combination.</p>
                <p className="text-cherry-600/80 text-sm mt-2">
                  Open the Director&apos;s Slate to loosen your filters.
                </p>
              </div>
            </motion.div>
          ) : (
            <div className="space-y-8">
              <section>
                <div className="rounded-xl border-2 border-brass/50 overflow-hidden bg-cherry-950 shadow-lg">
                  <div className="px-5 pt-5 pb-1">
                    <h2 className="text-lg font-display font-semibold text-neon-gold text-neon-glow">
                      {TIER_LABELS[0]}
                    </h2>
                  </div>
                  <div className="p-5 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      {tier1.map((movie, i) => (
                        <MovieCard
                          key={movie.id}
                          movie={movie}
                          index={i}
                          variant="featured"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <div className="rounded-xl border-2 border-brass/50 overflow-hidden bg-cherry-950 shadow-lg">
                  <div className="px-5 pt-5 pb-1">
                    <h2 className="text-lg font-display font-semibold text-neon-gold text-neon-glow">
                      {TIER_LABELS[1]}
                    </h2>
                  </div>
                  <div className="p-5 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {tier2.map((movie, i) => (
                        <MovieCard
                          key={movie.id}
                          movie={movie}
                          index={3 + i}
                          variant="compact"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <div className="rounded-xl border-2 border-brass/50 overflow-hidden bg-cherry-950 shadow-lg">
                  <div className="px-5 pt-5 pb-1">
                    <h2 className="text-lg font-display font-semibold text-neon-gold text-neon-glow">
                      {TIER_LABELS[2]}
                    </h2>
                  </div>
                  <div className="p-5 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {tier3.map((movie, i) => (
                        <MovieCard
                          key={movie.id}
                          movie={movie}
                          index={6 + i}
                          variant="compact"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </section>
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
