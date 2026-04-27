'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Sparkles, Home, Dices } from 'lucide-react';
import type { FilterState, Movie } from '@/lib/types';
import { defaultFilters } from '@/lib/types';
import { FILTER_WEIGHT_LOW, FILTER_WEIGHT_HIGH } from '@/lib/filterWeightSegments';
import { GENRE_OPTIONS } from '@/lib/optionSets';
import type { Genre } from '@/lib/types';
import Step1Basics from './wizard/Step1Basics';
import Step2Energy from './wizard/Step2Energy';
import Step4Pedigree from './wizard/Step4Pedigree';
import ResultsView from './ResultsView';
import SparkleBackground from './SparkleBackground';
import MarqueeLogo from './MarqueeLogo';

const STEPS = 3;
const SESSION_KEY = 'cinematch-results-state';
const ENERGY_KEY_TO_LEGACY: Record<
  | 'narrative_pacing'
  | 'emotional_tone'
  | 'brain_power'
  | 'visual_style'
  | 'suspense_level'
  | 'world_style',
  'pacing' | 'cryMeter' | 'humor' | 'romance' | 'suspense' | 'intensity'
> = {
  narrative_pacing: 'pacing',
  emotional_tone: 'cryMeter',
  brain_power: 'humor',
  visual_style: 'romance',
  suspense_level: 'suspense',
  world_style: 'intensity',
};

function clampSlider0to100(v: unknown, fallback = 50): number {
  if (v == null || v === '') return fallback;
  const x = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function sliderOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  return clampSlider0to100(v);
}

function pedigreeBandOrNull(v: unknown): 'low' | 'high' | null {
  if (v == null || v === '') return null;
  return v === 'low' || v === 'high' ? v : null;
}

/** Merge partial/corrupt session JSON into a complete `FilterState` (prevents refresh crashes). */
function mergeSanitizedFilters(raw: Partial<FilterState>): FilterState {
  /** Prefer new keys, then legacy session keys, then defaults (avoid default `narrative_pacing` masking `pacing`). */
  const narrative_pacing = sliderOrNull(raw.narrative_pacing ?? raw.pacing ?? null);
  const emotional_tone = sliderOrNull(raw.emotional_tone ?? raw.cryMeter ?? null);
  const brain_power = sliderOrNull(raw.brain_power ?? raw.humor ?? null);
  const visual_style = sliderOrNull(raw.visual_style ?? raw.romance ?? null);
  const suspense_level = sliderOrNull(raw.suspense_level ?? raw.suspense ?? null);
  const world_style = sliderOrNull(raw.world_style ?? raw.intensity ?? null);

  const genre = Array.isArray(raw.genre) ? raw.genre : [];
  const decade = Array.isArray(raw.decade) ? raw.decade.filter((d): d is NonNullable<typeof d> => d != null) : [];
  const oscarFilter =
    raw.oscarFilter === 'winner' || raw.oscarFilter === 'nominee' || raw.oscarFilter === 'both'
      ? raw.oscarFilter
      : null;
  const runtime =
    raw.runtime === 'short' || raw.runtime === 'medium' || raw.runtime === 'long' ? raw.runtime : null;
  const criticsVsFans =
    raw.criticsVsFans === 'critics' || raw.criticsVsFans === 'fans' || raw.criticsVsFans === 'both'
      ? raw.criticsVsFans
      : null;
  const crowd =
    raw.crowd === 'Solo' || raw.crowd === 'Date Night' || raw.crowd === 'Group' ? raw.crowd : null;

  const rawOriginCountry = raw.originCountry;
  const originCountry =
    rawOriginCountry === 'us' || rawOriginCountry === 'international-english' || rawOriginCountry === 'international-nonenglish'
      ? rawOriginCountry
      : null;

  return {
    ...defaultFilters,
    crowd,
    narrative_pacing,
    emotional_tone,
    brain_power,
    visual_style,
    suspense_level,
    world_style,
    pacing: narrative_pacing,
    cryMeter: emotional_tone,
    humor: brain_power,
    romance: visual_style,
    suspense: suspense_level,
    intensity: world_style,
    genre,
    aListCast: pedigreeBandOrNull(raw.aListCast),
    criticsVsFans,
    oscarFilter,
    decade,
    runtime,
    directorProminence: pedigreeBandOrNull(raw.directorProminence),
    originCountry,
  };
}

function normalizeEnergyAliases(input: FilterState): FilterState {
  return mergeSanitizedFilters(input);
}

export default function RedCarpetWizard() {
  const [step, setStep] = useState(1);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rollingDice, setRollingDice] = useState(false);

  /** Latest filters for fetch (avoids stale closures in debounced refetch). */
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  /** Restore results after refresh; always clear loading (fixes stuck spinner if fetch aborts / stringify fails / Strict Mode). */
  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    /** Hard cap so a hung API cannot leave the UI stuck forever (watchdog after fetch timeout). */
    const WATCHDOG_MS = 75_000;
    const watchdog = setTimeout(() => {
      if (!cancelled) {
        ac.abort();
        setLoading(false);
        setError('Taking too long — tap Home or try again.');
      }
    }, WATCHDOG_MS);

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

        const merged = mergeSanitizedFilters({ ...defaultFilters, ...(saved as Partial<FilterState>) });
        setFilters(merged);
        setShowResults(true);
        setLoading(true);
        setError(null);

        let bodyStr: string;
        try {
          bodyStr = JSON.stringify(merged);
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
            if (res.ok) {
              const list = data.movies ?? [];
              console.log('Client: Total Movies Received (session restore):', list.length);
              setResults(list);
            } else {
              setResults([]);
              setError(
                typeof (data as { error?: string }).error === 'string'
                  ? (data as { error: string }).error
                  : 'Request failed'
              );
            }
          }
        } catch (e) {
          if (!cancelled) {
            setResults([]);
            if (e instanceof Error && e.name !== 'AbortError') {
              setError(e.message);
            } else if (e instanceof Error && e.name === 'AbortError') {
              setError('Request timed out — try again or tap Home.');
            }
          }
        } finally {
          clearTimeout(timeoutId);
          if (!cancelled) setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    void restoreSession().finally(() => {
      clearTimeout(watchdog);
    });

    return () => {
      cancelled = true;
      clearTimeout(watchdog);
      ac.abort();
      setLoading(false);
    };
  }, []);

  /** Chaos Mode: one random genre + random energy/pedigree weights. */
  function generateRandomVibe(): FilterState {
    // --- Genre: 1 genre (75%) or 2 genres (25%) ---
    const shuffledGenres = [...GENRE_OPTIONS].sort(() => Math.random() - 0.5);
    const genreCount = Math.random() < 0.25 ? 2 : 1;
    const genre = shuffledGenres.slice(0, genreCount) as Genre[];

    // --- Energy sliders: activate 2 (40%) or 3 (60%) of the 6 axes.
    // Only use LOW or HIGH — MED=50 is effectively neutral and wastes a slot.
    const ENERGY_AXES = [
      'narrative_pacing', 'emotional_tone', 'brain_power',
      'visual_style', 'suspense_level', 'world_style',
    ] as const;
    const shuffledAxes = [...ENERGY_AXES].sort(() => Math.random() - 0.5);
    const activeCount = Math.random() < 0.4 ? 2 : 3;
    const activeAxes = new Set(shuffledAxes.slice(0, activeCount));
    const pickExtreme = () => Math.random() < 0.5 ? FILTER_WEIGHT_LOW : FILTER_WEIGHT_HIGH;

    const narrative_pacing = activeAxes.has('narrative_pacing') ? pickExtreme() : null;
    const emotional_tone  = activeAxes.has('emotional_tone')  ? pickExtreme() : null;
    const brain_power     = activeAxes.has('brain_power')     ? pickExtreme() : null;
    const visual_style    = activeAxes.has('visual_style')    ? pickExtreme() : null;
    const suspense_level  = activeAxes.has('suspense_level')  ? pickExtreme() : null;
    const world_style     = activeAxes.has('world_style')     ? pickExtreme() : null;

    // --- Pedigree filters: each activates ~35% of the time, independently.
    // When both activate, align them (same direction) to avoid logical contradictions
    // like A-list cast + unknown director or vice versa.
    const castActive = Math.random() < 0.35;
    const dirActive  = Math.random() < 0.35;
    let aListCast: FilterState['aListCast'] = null;
    let directorProminence: FilterState['directorProminence'] = null;
    if (castActive && dirActive) {
      const dir = Math.random() < 0.5 ? 'high' : 'low';
      aListCast = dir;
      directorProminence = dir;
    } else if (castActive) {
      aListCast = Math.random() < 0.5 ? 'high' : 'low';
    } else if (dirActive) {
      directorProminence = Math.random() < 0.5 ? 'high' : 'low';
    }

    // --- Optional decade: ~30% chance ---
    const ALL_DECADES = ['60s', '70s', '80s', '90s', '2000s', '2010s', '2020s'] as const;
    const decade: FilterState['decade'] = Math.random() < 0.3
      ? [ALL_DECADES[Math.floor(Math.random() * ALL_DECADES.length)]]
      : [];

    // --- Optional critics/fans: ~20% chance ---
    const CF_OPTIONS = ['critics', 'fans', 'both'] as const;
    const criticsVsFans: FilterState['criticsVsFans'] = Math.random() < 0.2
      ? CF_OPTIONS[Math.floor(Math.random() * CF_OPTIONS.length)]
      : null;

    return {
      ...defaultFilters,
      genre,
      decade,
      aListCast,
      directorProminence,
      criticsVsFans,
      narrative_pacing,
      emotional_tone,
      brain_power,
      visual_style,
      suspense_level,
      world_style,
      // Mirror into legacy aliases so ResultsView sliders display correctly.
      pacing:    narrative_pacing ?? defaultFilters.pacing,
      cryMeter:  emotional_tone   ?? defaultFilters.cryMeter,
      humor:     brain_power      ?? defaultFilters.humor,
      romance:   visual_style     ?? defaultFilters.romance,
      suspense:  suspense_level   ?? defaultFilters.suspense,
      intensity: world_style      ?? defaultFilters.intensity,
    };
  }

  const updateFilters = (patch: Partial<FilterState>) => {
    const mirrored = { ...patch } as Partial<FilterState>;
    for (const key of Object.keys(ENERGY_KEY_TO_LEGACY) as (keyof typeof ENERGY_KEY_TO_LEGACY)[]) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        const legacyKey = ENERGY_KEY_TO_LEGACY[key];
        mirrored[legacyKey] = patch[key] as FilterState[typeof legacyKey];
      }
    }
    setFilters((prev) => ({ ...prev, ...mirrored }));
  };

  const runFetch = useCallback(async (discoverStartPage?: number, filtersOverride?: FilterState) => {
    const f = normalizeEnergyAliases(filtersOverride ?? filtersRef.current);
    try {
      const body: Record<string, unknown> = { ...f };
      if (discoverStartPage != null) body.discoverStartPage = discoverStartPage;
      const res = await fetch('/api/tmdb/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const contentType = res.headers.get('content-type') ?? '';
      const isJson = contentType.toLowerCase().includes('application/json');
      const data = isJson ? await res.json() : null;
      if (!res.ok) {
        const fallback =
          !isJson
            ? `Request failed (${res.status}). Non-JSON response from server; make sure you are on the active dev port (usually localhost:3000).`
            : `Request failed (${res.status})`;
        setError((data as { error?: string; details?: string } | null)?.error ?? (data as { details?: string } | null)?.details ?? fallback);
        setResults([]);
      } else {
        const list = (data as { movies?: Movie[] } | null)?.movies ?? [];
        console.log('Client: Total Movies Received:', list.length);
        setResults(list);
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
  }, []);

  const fetchResults = (discoverStartPage?: number) => {
    setLoading(true);
    setError(null);
    setTimeout(() => runFetch(discoverStartPage), 10);
  };

  const handleFindMatch = () => {
    setLoading(true);
    setError(null);
    setShowResults(true);
    setTimeout(() => runFetch(undefined, filtersRef.current), 10);
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
      <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
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
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-x-hidden bg-cherry-950">
      <SparkleBackground currentStep={step} />
      {/* Header stays pinned while the single main column scrolls (no nested step scroll). */}
      <div className="sticky top-0 z-[60] flex-shrink-0 bg-cherry-950 border-b border-brass/40 shadow-[0_4px_24px_rgba(0,0,0,0.35)]">
        <header className="py-3 px-4 sm:py-4 sm:px-6">
          <div className="w-full grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className="flex justify-center min-w-0">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-sm border-2 border-brass/50 text-brass-light hover:border-brass hover:bg-brass/10 transition-all touch-manipulation text-sm font-medium"
                title="Home (step 1)"
              >
                <Home className="w-3.5 h-3.5" />
                <span className="hidden min-[360px]:inline">Home</span>
              </button>
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
                <span className="hidden min-[360px]:inline">{rollingDice ? 'Rolling…' : 'Surprise Me'}</span>
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

        <div className="px-4 sm:px-6 py-2 flex items-center justify-center gap-2">
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

      <main className="relative z-10 min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain custom-scrollbar">
        <div className="flex w-full flex-col items-center px-4 py-4 sm:px-6 sm:py-6">
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
                  originCountry={filters.originCountry}
                  onGenreChange={(g) => updateFilters({ genre: g })}
                  onDecadeChange={(d) => updateFilters({ decade: d })}
                  onRuntimeChange={(r) => updateFilters({ runtime: r })}
                  onOriginCountryChange={(c) => updateFilters({ originCountry: c })}
                  onResetStep={() =>
                    updateFilters({ genre: [], decade: [], runtime: null, originCountry: null })
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
                  narrative_pacing={filters.narrative_pacing}
                  emotional_tone={filters.emotional_tone}
                  brain_power={filters.brain_power}
                  visual_style={filters.visual_style}
                  suspense_level={filters.suspense_level}
                  world_style={filters.world_style}
                  onChange={(key, value) => updateFilters({ [key]: value })}
                  onToggle={(key, active) =>
                    updateFilters({ [key]: active ? FILTER_WEIGHT_LOW : null })
                  }
                  onResetStep={() =>
                    updateFilters({
                      narrative_pacing: null,
                      emotional_tone: null,
                      brain_power: null,
                      visual_style: null,
                      suspense_level: null,
                      world_style: null,
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
                <Step4Pedigree
                  aListCast={filters.aListCast}
                  directorProminence={filters.directorProminence}
                  oscarFilter={filters.oscarFilter}
                  criticsVsFans={filters.criticsVsFans}
                  onAListCast={(v) => updateFilters({ aListCast: v })}
                  onDirectorProminence={(v) => updateFilters({ directorProminence: v })}
                  onOscarFilter={(v) => updateFilters({ oscarFilter: v })}
                  onCriticsVsFans={(v) => updateFilters({ criticsVsFans: v })}
                  onResetStep={() =>
                    updateFilters({
                      aListCast: null,
                      directorProminence: null,
                      oscarFilter: null,
                      criticsVsFans: null,
                    })
                  }
                />
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      <div className="z-20 flex flex-shrink-0 flex-col gap-2 border-t border-brass/40 bg-cherry-950 px-4 pt-3 shadow-[0_-4px_24px_rgba(0,0,0,0.35)] pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="flex min-h-[44px] items-center gap-2 rounded-lg border-2 border-brass/50 px-5 py-3 text-brass-light transition-all hover:border-brass hover:bg-brass/10 touch-manipulation disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>
          <div className="flex-1" />
          {step < STEPS ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="flex min-h-[44px] items-center gap-2 rounded-lg border-2 border-brass bg-brass/20 px-6 py-3 text-neon-gold transition-all hover:bg-brass/30 touch-manipulation"
            >
              Next
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFindMatch}
              className="flex min-h-[44px] items-center gap-2 rounded-lg border-2 border-brass bg-brass/30 px-6 py-3 font-semibold text-neon-gold shadow-brass transition-all hover:bg-brass/40 touch-manipulation"
            >
              <Sparkles className="w-5 h-5" />
              Find Results
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
