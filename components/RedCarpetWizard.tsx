'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Sparkles, Home, Dices } from 'lucide-react';
import type { FilterState, Movie } from '@/lib/types';
import { defaultFilters } from '@/lib/types';
import {
  GENRE_OPTIONS,
  ALL_THEME_OPTIONS,
  ALL_VISUAL_STYLE_OPTIONS,
  ALL_SOUNDTRACK_OPTIONS,
} from '@/lib/optionSets';
import type { Theme, VisualStyle, Soundtrack, Genre } from '@/lib/types';
import Step1Basics from './wizard/Step1Basics';
import Step2Energy from './wizard/Step2Energy';
import Step4Aesthetic from './wizard/Step4Aesthetic';
import Step4Pedigree from './wizard/Step4Pedigree';
import ResultsView from './ResultsView';
import SparkleBackground from './SparkleBackground';
import MarqueeLogo from './MarqueeLogo';

const STEPS = 4;
const SESSION_KEY = 'cinematch-results-state';

export default function RedCarpetWizard() {
  const [step, setStep] = useState(1);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rollingDice, setRollingDice] = useState(false);

  /** Restore results after refresh; always clear loading (fixes stuck spinner if fetch aborts / stringify fails / Strict Mode). */
  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();

    async function restoreSession() {
      try {
        const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(SESSION_KEY) : null;
        if (!raw) return;
        let parsed: { filters?: FilterState; wasOnResults?: boolean };
        try {
          parsed = JSON.parse(raw) as { filters?: FilterState; wasOnResults?: boolean };
        } catch {
          return;
        }
        const { filters: saved, wasOnResults } = parsed;
        if (!wasOnResults || saved == null) return;

        setFilters({ ...defaultFilters, ...saved });
        setShowResults(true);
        setLoading(true);

        let bodyStr: string;
        try {
          bodyStr = JSON.stringify({ ...saved });
        } catch {
          if (!cancelled) setLoading(false);
          return;
        }

        const timeoutMs = 60_000;
        const timeoutId = setTimeout(() => ac.abort(), timeoutMs);
        try {
          const res = await fetch('/api/tmdb/match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: bodyStr,
            signal: ac.signal,
          });
          let data: { movies?: Movie[] } = {};
          try {
            data = (await res.json()) as { movies?: Movie[] };
          } catch {
            /* non-JSON body */
          }
          if (!cancelled) {
            if (res.ok) setResults(data.movies ?? []);
            else setResults([]);
          }
        } catch (e) {
          if (!cancelled && e instanceof Error && e.name !== 'AbortError') {
            setResults([]);
          }
        } finally {
          clearTimeout(timeoutId);
          if (!cancelled) setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
      ac.abort();
      setLoading(false);
    };
  }, []);

  /** Chaos Mode: one random genre, 2–3 random atmosphere tags, all sliders random 0–100; returns full FilterState. */
  function generateRandomVibe(): FilterState {
    const theme: Theme[] = [];
    const visualStyle: VisualStyle[] = [];
    const soundtrack: Soundtrack[] = [];
    const allTags: { t: 'theme'; v: Theme }[] = ALL_THEME_OPTIONS.map((t) => ({ t: 'theme', v: t }));
    const allVisual: { t: 'visual'; v: VisualStyle }[] = ALL_VISUAL_STYLE_OPTIONS.map((v) => ({ t: 'visual', v }));
    const allSound: { t: 'sound'; v: Soundtrack }[] = ALL_SOUNDTRACK_OPTIONS.map((s) => ({ t: 'sound', v: s }));
    const combined = [...allTags, ...allVisual, ...allSound];
    for (let i = combined.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [combined[i], combined[j]] = [combined[j], combined[i]];
    }
    const count = 2 + Math.floor(Math.random() * 2);
    const chosen = combined.slice(0, count);
    chosen.forEach(({ t, v }) => {
      if (t === 'theme') theme.push(v);
      else if (t === 'visual') visualStyle.push(v);
      else soundtrack.push(v);
    });

    const oneGenre: Genre = GENRE_OPTIONS[Math.floor(Math.random() * GENRE_OPTIONS.length)];
    const rand = () => Math.floor(Math.random() * 101);

    return {
      ...defaultFilters,
      genre: [oneGenre],
      theme,
      visualStyle,
      soundtrack,
      pacing: rand(),
      intensity: rand(),
      cryMeter: rand(),
      humor: rand(),
      romance: rand(),
      suspense: rand(),
      aListCastAny: false,
      aListCast: rand(),
      directorProminenceAny: false,
      directorProminence: rand(),
    };
  }

  const updateFilters = (patch: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const runFetch = async (discoverStartPage?: number, filtersOverride?: FilterState) => {
    const f = filtersOverride ?? filters;
    try {
      const body: Record<string, unknown> = { ...f };
      if (discoverStartPage != null) body.discoverStartPage = discoverStartPage;
      const res = await fetch('/api/tmdb/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? data.details ?? 'Request failed');
        setResults([]);
      } else {
        setResults(data.movies ?? []);
        try {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify({ filters: f, wasOnResults: true }));
        } catch {
          // ignore
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchResults = (discoverStartPage?: number) => {
    setLoading(true);
    setError(null);
    setTimeout(() => runFetch(discoverStartPage), 10);
  };

  const handleFindMatch = () => {
    setLoading(true);
    setError(null);
    setShowResults(true);
    setTimeout(() => runFetch(), 10);
  };

  const handleSurpriseMe = () => {
    setRollingDice(true);
    const vibe = generateRandomVibe();
    setFilters(vibe);
    const startPage = Math.floor(Math.random() * 10) + 1;
    setTimeout(() => {
      setRollingDice(false);
      setError(null);
      setShowResults(true);
      setLoading(true);
      setTimeout(() => runFetch(startPage, vibe), 10);
    }, 500);
  };

  if (showResults) {
    return (
      <ResultsView
        filters={filters}
        onUpdateFilters={updateFilters}
        onBackToWizard={() => {
          try {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify({ wasOnResults: false }));
          } catch {
            // ignore
          }
          setShowResults(false);
          setLoading(false);
          setError(null);
          setStep(1);
        }}
        results={results}
        loading={loading}
        error={error}
        onRefresh={fetchResults}
        onSurpriseMe={handleSurpriseMe}
        rollingDice={rollingDice}
      />
    );
  }

  return (
    <div className="min-h-screen bg-cherry-950 flex flex-col relative">
      <SparkleBackground currentStep={step} />
      <div className="sticky top-0 left-0 right-0 z-20 bg-cherry-950">
        <header className="border-b border-brass/40 py-3 px-4 sm:py-4 sm:px-6">
          <div className="w-full grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className="flex justify-center min-w-0">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-sm border-2 border-brass/50 text-brass-light hover:border-brass hover:bg-brass/10 transition-all touch-manipulation text-sm font-medium"
                  title="Home (step 1)"
                >
                  <Home className="w-3.5 h-3.5" />
                  Home
                </button>
              )}
            </div>
            <div className="flex justify-center shrink-0">
              <MarqueeLogo text="CINEMATCH" />
            </div>
            <div className="flex justify-center min-w-0">
              <button
                type="button"
                onClick={handleSurpriseMe}
                disabled={rollingDice || loading}
                className="flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-sm border-2 border-brass/50 text-brass-light hover:border-brass hover:bg-brass/10 transition-all touch-manipulation disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium"
                title="Surprise Me (Chaos Mode)"
              >
                <Dices className={`w-3.5 h-3.5 ${rollingDice ? 'animate-pulse' : ''}`} aria-hidden />
                <span>{rollingDice ? 'Rolling the dice…' : 'Surprise Me'}</span>
              </button>
            </div>
          </div>
        </header>

        <div className="h-1 bg-cherry-900">
          <motion.div
            className="h-full bg-brass"
            initial={false}
            animate={{ width: `${(step / STEPS) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>

        <div className="px-4 sm:px-6 py-2 flex items-center justify-center gap-2 bg-cherry-950 border-b border-brass/40">
        <span className="text-antique text-sm">
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
                  onResetStep={() =>
                    updateFilters({ genre: [], decade: [], runtime: null })
                  }
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
                  onResetStep={() =>
                    updateFilters({
                      pacing: 50,
                      intensity: 50,
                      cryMeter: 50,
                      humor: 50,
                      romance: 50,
                      suspense: 50,
                    })
                  }
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
                  onResetStep={() =>
                    updateFilters({ theme: [], visualStyle: [], soundtrack: [] })
                  }
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
                  aListCastAny={filters.aListCastAny}
                  aListCast={filters.aListCast}
                  directorProminenceAny={filters.directorProminenceAny}
                  directorProminence={filters.directorProminence}
                  oscarFilter={filters.oscarFilter}
                  criticsVsFans={filters.criticsVsFans}
                  onAListCastAny={(v) => updateFilters({ aListCastAny: v })}
                  onAListCast={(v) => updateFilters({ aListCast: v })}
                  onDirectorProminenceAny={(v) => updateFilters({ directorProminenceAny: v })}
                  onDirectorProminence={(v) => updateFilters({ directorProminence: v })}
                  onOscarFilter={(v) => updateFilters({ oscarFilter: v })}
                  onCriticsVsFans={(v) => updateFilters({ criticsVsFans: v })}
                  onResetStep={() =>
                    updateFilters({
                      aListCastAny: true,
                      aListCast: 50,
                      directorProminenceAny: true,
                      directorProminence: 50,
                      oscarFilter: 'any',
                      criticsVsFans: null,
                    })
                  }
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
            <div className="flex-1" />
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
