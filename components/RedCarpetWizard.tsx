'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Sparkles, Home } from 'lucide-react';
import type { FilterState, Movie } from '@/lib/types';
import { defaultFilters } from '@/lib/types';
import Step1Basics from './wizard/Step1Basics';
import Step2Energy from './wizard/Step2Energy';
import Step4Aesthetic from './wizard/Step4Aesthetic';
import Step4Pedigree from './wizard/Step4Pedigree';
import ResultsView from './ResultsView';
import SparkleBackground from './SparkleBackground';
import MarqueeLogo from './MarqueeLogo';

const STEPS = 4;

export default function RedCarpetWizard() {
  const [step, setStep] = useState(1);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<Movie[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateFilters = (patch: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const fetchResults = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tmdb/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? data.details ?? 'Request failed');
        setResults([]);
      } else {
        setResults(data.movies ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFindMatch = async () => {
    await fetchResults();
    setShowResults(true);
  };

  if (showResults) {
    return (
      <ResultsView
        filters={filters}
        onUpdateFilters={updateFilters}
        onBackToWizard={() => { setShowResults(false); setError(null); }}
        results={results ?? []}
        loading={loading}
        error={error}
        onRefresh={fetchResults}
      />
    );
  }

  return (
    <div className="min-h-screen bg-cherry-950 flex flex-col relative">
      <SparkleBackground currentStep={step} />
      <header className="sticky top-0 left-0 right-0 border-b border-brass/40 py-3 px-4 sm:py-4 sm:px-6 z-20 bg-cherry-950">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-3 relative">
          <div className="flex-1 min-w-0 flex items-center">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-lg border-2 border-brass/50 text-brass-light hover:border-brass hover:bg-brass/10 transition-all touch-manipulation"
                title="Home (step 1)"
              >
                <Home className="w-4 h-4" />
                Home
              </button>
            )}
          </div>
          <MarqueeLogo text="CINEMATCH" />
          <div className="flex-1 min-w-0" aria-hidden />
        </div>
      </header>

      <div className="h-1 bg-cherry-900 relative z-10">
        <motion.div
          className="h-full bg-brass"
          initial={false}
          animate={{ width: `${(step / STEPS) * 100}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      <div className="px-4 sm:px-6 py-2 flex items-center justify-center gap-2 bg-cherry-950 border-b border-brass/40 relative z-10">
        <span className="text-cream text-sm">
          Step {step} of {STEPS}
        </span>
        <div className="flex items-center gap-1.5 ml-2" aria-hidden>
          {Array.from({ length: STEPS }, (_, i) => (
            <motion.span
              key={i}
              className={`inline-block w-2 h-2 rounded-full border border-brass/60 ${
                i + 1 <= step ? 'bg-brass' : 'bg-cherry-900'
              }`}
              initial={false}
              animate={{
                opacity: i + 1 === step ? 1 : i + 1 < step ? 0.9 : 0.4,
                scale: i + 1 === step ? 1.2 : 1,
              }}
              transition={{ duration: 0.35 }}
            />
          ))}
        </div>
      </div>

      <main className="flex-1 min-h-0 flex flex-col relative z-10">
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center px-4 py-4 sm:px-6 sm:py-6">
          <div className="w-full max-w-2xl">
            <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
              >
                <Step1Basics
                  genre={filters.genre}
                  decade={filters.decade.filter((d): d is NonNullable<typeof d> => d != null)}
                  runtime={filters.runtime}
                  onGenreChange={(g) => updateFilters({ genre: g })}
                  onDecadeChange={(d) => updateFilters({ decade: d })}
                  onRuntimeChange={(r) => updateFilters({ runtime: r })}
                />
              </motion.div>
            )}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
              >
                <Step2Energy
                  pacing={filters.pacing}
                  intensity={filters.intensity}
                  cryMeter={filters.cryMeter}
                  humor={filters.humor}
                  romance={filters.romance}
                  suspense={filters.suspense}
                  onChange={(key, value) => updateFilters({ [key]: value })}
                />
              </motion.div>
            )}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
              >
                <Step4Aesthetic
                  theme={filters.theme}
                  visualStyle={filters.visualStyle}
                  soundtrack={filters.soundtrack}
                  onThemeToggle={(t) => {
                    const next = filters.theme.includes(t)
                      ? filters.theme.filter((x) => x !== t)
                      : [...filters.theme, t];
                    updateFilters({ theme: next });
                  }}
                  onVisualStyleToggle={(v) => {
                    const next = filters.visualStyle.includes(v)
                      ? filters.visualStyle.filter((x) => x !== v)
                      : [...filters.visualStyle, v];
                    updateFilters({ visualStyle: next });
                  }}
                  onSoundtrackToggle={(v) => {
                    const next = filters.soundtrack.includes(v)
                      ? filters.soundtrack.filter((x) => x !== v)
                      : [...filters.soundtrack, v];
                    updateFilters({ soundtrack: next });
                  }}
                />
              </motion.div>
            )}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
              >
                <Step4Pedigree
                  cultClassic={filters.cultClassic}
                  aListCast={filters.aListCast}
                  criticsVsFans={filters.criticsVsFans}
                  oscarWinner={filters.oscarWinner}
                  oscarNominee={filters.oscarNominee}
                  directorProminence={filters.directorProminence}
                  onCultClassic={(v) => updateFilters({ cultClassic: v })}
                  onAListCast={(v) => updateFilters({ aListCast: v })}
                  onCriticsVsFans={(v) => updateFilters({ criticsVsFans: v })}
                  onOscarWinner={(v) => updateFilters({ oscarWinner: v })}
                  onOscarNominee={(v) => updateFilters({ oscarNominee: v })}
                  onDirectorProminence={(v) => updateFilters({ directorProminence: v })}
                />
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex-shrink-0 sticky bottom-0 left-0 right-0 flex flex-col gap-2 pt-3 pb-5 sm:pb-6 px-4 sm:px-6 bg-cherry-950 border-t border-brass/40 z-20">
          <div className="flex items-center justify-between w-full max-w-2xl mx-auto gap-3">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              className="flex items-center gap-2 min-h-[44px] px-5 py-3 rounded-lg border-2 border-brass/50 text-brass-light disabled:opacity-40 disabled:cursor-not-allowed hover:border-brass hover:bg-brass/10 transition-all touch-manipulation"
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>
            <div className="flex-1" aria-hidden />
            {step < STEPS ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="flex items-center gap-2 min-h-[44px] px-6 py-3 rounded-lg border-2 border-brass bg-brass/20 text-neon-gold hover:bg-brass/30 transition-all touch-manipulation"
            >
              Next
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFindMatch}
              className="flex items-center gap-2 min-h-[44px] px-6 py-3 rounded-lg border-2 border-brass bg-brass/30 text-neon-gold shadow-brass hover:bg-brass/40 transition-all font-semibold touch-manipulation"
            >
              <Sparkles className="w-5 h-5" />
              Find My Match
            </button>
          )}
          </div>
        </div>
      </main>
    </div>
  );
}
