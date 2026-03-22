'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlidersHorizontal, X, Plus, Minus, RotateCcw, Film, Zap, Palette, Award } from 'lucide-react';
import type { FilterState, VisualStyle, Soundtrack, Genre, Theme, CriticsVsFans, Decade, Runtime } from '@/lib/types';
import { MAX_GENRES } from '@/lib/types';
import { ALL_VISUAL_STYLE_OPTIONS, ALL_SOUNDTRACK_OPTIONS, ALL_THEME_OPTIONS, GENRE_OPTIONS } from '@/lib/optionSets';
import EnergySliderRow from '@/components/wizard/EnergySliderRow';
import SteppedRangeTrack from '@/components/wizard/SteppedRangeTrack';

const SLIDER_CONFIG = [
  { key: 'pacing' as const, label: 'Pacing' },
  { key: 'cryMeter' as const, label: 'Cry Meter' },
  { key: 'humor' as const, label: 'Humor' },
  { key: 'romance' as const, label: 'Romance' },
  { key: 'suspense' as const, label: 'Suspense' },
] as const;

const PREVIEW_COUNT = 3;

function ChipRow<T extends string>({
  options,
  selectedSet,
  onToggle,
  expanded,
  onExpandToggle,
  label,
  icon,
}: {
  options: T[];
  selectedSet: T[];
  onToggle: (opt: T) => void;
  expanded: boolean;
  onExpandToggle: () => void;
  label: string;
  icon?: React.ReactNode;
}) {
  const selectedInList = selectedSet.filter((s) => options.includes(s));
  const rest = options.filter((o) => !selectedSet.includes(o));
  const visible = expanded ? options : [...selectedInList, ...rest].slice(0, PREVIEW_COUNT);
  const hasMore = options.length > PREVIEW_COUNT;

  return (
    <div>
      <label className="block text-sm font-medium text-brass-light mb-2 flex items-center gap-1.5">
        {icon}
        {label}
      </label>
      <div className="flex flex-wrap gap-2 items-center">
        {visible.map((opt) => {
          const selected = selectedSet.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              className={`px-3 py-1.5 rounded-sm border-2 text-sm transition-all duration-300 ${
                selected
                  ? 'border-brass bg-brass/15 text-neon-gold shadow-[0_0_20px_rgba(184,134,11,0.4)]'
                  : 'border-brass/50 text-cream hover:border-brass hover:text-brass-light'
              }`}
            >
              {opt}
            </button>
          );
        })}
        {hasMore && (
          <button
            type="button"
            onClick={onExpandToggle}
            className="flex items-center justify-center w-8 h-8 rounded-sm border-2 border-brass/50 text-cream hover:border-brass hover:bg-brass/10 hover:text-brass-light transition-all"
            aria-label={expanded ? 'Show less' : 'Show more'}
            title={expanded ? 'Show less' : 'Show more'}
          >
            {expanded ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

interface DirectorsConsoleProps {
  filters: FilterState;
  onUpdate: (patch: Partial<FilterState>) => void;
  onOpenChange?: (open: boolean) => void;
  /** Call to re-fetch results with current filters (e.g. after changing sliders). */
  onRefresh?: () => void;
  /** Reset all slate filters to default empty state. */
  onClearSelections?: () => void;
  /** When true, float the FAB above the fixed results pagination bar. */
  liftFabAbovePagination?: boolean;
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-brass/40 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-brass/30">
        <Icon className="w-4 h-4 text-brass" />
        <h3 className="text-sm font-display font-semibold text-neon-gold uppercase tracking-wide">{title}</h3>
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

export default function DirectorsConsole({
  filters,
  onUpdate,
  onOpenChange,
  onRefresh,
  onClearSelections,
  liftFabAbovePagination = false,
}: DirectorsConsoleProps) {
  const [open, setOpen] = useState(false);
  const [expandedGenre, setExpandedGenre] = useState(false);
  const [expandedTheme, setExpandedTheme] = useState(false);
  const [expandedVisual, setExpandedVisual] = useState(false);
  const [expandedSoundtrack, setExpandedSoundtrack] = useState(false);

  const openModal = () => {
    setOpen(true);
    onOpenChange?.(true);
  };
  const closeModal = () => {
    setOpen(false);
    onOpenChange?.(false);
  };

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  return (
    <>
      <motion.button
        type="button"
        onClick={openModal}
        className={`fixed z-[45] rounded-3xl bg-brass p-[2px] shadow-brass hover:bg-brass/90 transition-all right-[max(1.5rem,env(safe-area-inset-right))] ${
          liftFabAbovePagination
            ? 'bottom-[calc(5.25rem+env(safe-area-inset-bottom))]'
            : 'bottom-[max(1.5rem,env(safe-area-inset-bottom))]'
        }`}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        aria-label="Open Director's Slate"
      >
        <span className="flex min-h-[44px] items-center gap-2 rounded-[calc(1.5rem-2px)] bg-cherry-900 px-5 py-3 font-medium text-neon-gold transition-colors hover:bg-brass/20">
          <SlidersHorizontal className="w-5 h-5" />
          Director&apos;s Slate
        </span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 z-[50]"
              onClick={closeModal}
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[50] flex items-center justify-center p-4"
              style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))', paddingTop: 'max(1rem, env(safe-area-inset-top))', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
            >
              <motion.div
                initial={{ scale: 0.96 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.96 }}
                transition={{ type: 'spring', damping: 25 }}
                className="flex w-full max-w-2xl min-h-0 max-h-full flex-col rounded-3xl bg-brass p-[2px] shadow-neon-glow"
                style={{ maxHeight: 'min(85dvh, calc(100svh - 2rem))' }}
              >
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[calc(1.5rem-2px)] bg-cherry-950">
              <div className="flex items-center justify-between px-4 py-3 border-b border-brass/40 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-display font-semibold text-neon-gold text-neon-glow">
                    Director&apos;s Slate
                  </h2>
                  {typeof onClearSelections === 'function' && (
                    <button
                      type="button"
                      onClick={() => {
                        onClearSelections();
                      }}
                      className="p-1.5 text-brass-light hover:text-neon-gold transition-colors"
                      aria-label="Clear selections"
                      title="Clear selections"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {typeof onRefresh === 'function' && (
                    <button
                      type="button"
                      onClick={() => { onRefresh?.(); closeModal(); }}
                      className="h-9 min-w-[2.25rem] px-3 flex items-center justify-center rounded-sm border-2 border-brass/50 text-brass-light hover:border-brass hover:bg-brass/10 transition-all text-sm font-medium bg-cherry-950"
                    >
                      Find Results
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeModal}
                    className="h-9 w-9 flex items-center justify-center rounded-sm border-2 border-brass/50 text-brass-light hover:bg-brass/10"
                  >
                    <X className="w-5 h-5" aria-hidden />
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto scroll-area-slate p-4">
                <div className="space-y-4">
                  {/* The Basics */}
                  <Section title="The Basics" icon={Film}>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <ChipRow
                    options={['Any', ...GENRE_OPTIONS] as (Genre | 'Any')[]}
                    selectedSet={filters.genre.length === 0 ? ['Any'] : filters.genre}
                    onToggle={(opt) => {
                      if (opt === 'Any') onUpdate({ genre: [] });
                      else {
                        const g = opt as Genre;
                        if (filters.genre.includes(g)) onUpdate({ genre: filters.genre.filter((x) => x !== g) });
                        else if (filters.genre.length < MAX_GENRES) onUpdate({ genre: [...filters.genre, g] });
                      }
                    }}
                    expanded={expandedGenre}
                    onExpandToggle={() => setExpandedGenre((e) => !e)}
                    label="Genre"
                  />
                  <div>
                    <label className="block text-sm font-medium text-brass-light mb-2">Decade</label>
                    <div className="flex flex-wrap gap-2">
                      {(['60s', '70s', '80s', '90s', '2000s', '2010s', '2020s'] as const).map((label) => {
                        const value = label as NonNullable<Decade>;
                        const selected = filters.decade.includes(value);
                        return (
                          <button
                            key={label}
                            type="button"
                            onClick={() => {
                              if (selected) onUpdate({ decade: filters.decade.filter((d) => d !== value) });
                              else onUpdate({ decade: [...filters.decade.filter((d) => d != null), value] });
                            }}
                            className={`px-3 py-1.5 rounded-sm border-2 text-sm transition-all duration-300 ${
                              selected ? 'border-brass bg-brass/15 text-neon-gold shadow-[0_0_20px_rgba(184,134,11,0.4)]' : 'border-brass/50 text-cream hover:border-brass hover:text-brass-light'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-brass-light mb-2">Runtime</label>
                    <div className="flex gap-2">
                      {([null, 'short', 'medium', 'long'] as const).map((v) => (
                        <button
                          key={String(v)}
                          type="button"
                          onClick={() => onUpdate({ runtime: v })}
                          className={`px-3 py-1.5 rounded-sm border-2 text-sm transition-all duration-300 ${
                            filters.runtime === v ? 'border-brass bg-brass/15 text-neon-gold shadow-[0_0_20px_rgba(184,134,11,0.4)]' : 'border-brass/50 text-cream hover:border-brass hover:text-brass-light'
                          }`}
                        >
                          {v == null ? 'Any' : v === 'short' ? 'Short (<90 min)' : v === 'medium' ? 'Medium (90–150 min)' : 'Long (2.5 hr+)'}
                        </button>
                      ))}
                    </div>
                  </div>
                    </div>
                  </Section>

                  {/* Energy & emotion – sliders affect ranking only; closer match = higher in results */}
                  <Section title="Energy & emotion" icon={Zap}>
                    <div className="grid sm:grid-cols-2 gap-4">
                  {SLIDER_CONFIG.map(({ key, label }) => (
                    <EnergySliderRow
                      key={key}
                      label={label}
                      value={filters[key]}
                      onChange={(v) => onUpdate({ [key]: v })}
                    />
                  ))}
                    </div>
                  </Section>

                  {/* Aesthetic */}
                  <Section title="Aesthetic" icon={Palette}>
                    <div className="grid sm:grid-cols-2 gap-4">
                  <ChipRow
                    options={ALL_THEME_OPTIONS}
                    selectedSet={filters.theme}
                    onToggle={(t) =>
                      onUpdate({
                        theme: filters.theme.includes(t)
                          ? filters.theme.filter((x) => x !== t)
                          : [...filters.theme, t],
                      })
                    }
                    expanded={expandedTheme}
                    onExpandToggle={() => setExpandedTheme((e) => !e)}
                    label="Theme / Mood"
                  />

                  {/* Visual Style – first 3 + expand */}
                  <ChipRow
                    options={ALL_VISUAL_STYLE_OPTIONS}
                    selectedSet={filters.visualStyle}
                    onToggle={(v) =>
                      onUpdate({
                        visualStyle: filters.visualStyle.includes(v)
                          ? filters.visualStyle.filter((x) => x !== v)
                          : [...filters.visualStyle, v],
                      })
                    }
                    expanded={expandedVisual}
                    onExpandToggle={() => setExpandedVisual((e) => !e)}
                    label="Visual Style"
                  />

                  {/* Soundtrack – first 3 + expand */}
                  <ChipRow
                    options={ALL_SOUNDTRACK_OPTIONS}
                    selectedSet={filters.soundtrack}
                    onToggle={(s) =>
                      onUpdate({
                        soundtrack: filters.soundtrack.includes(s)
                          ? filters.soundtrack.filter((x) => x !== s)
                          : [...filters.soundtrack, s],
                      })
                    }
                    expanded={expandedSoundtrack}
                    onExpandToggle={() => setExpandedSoundtrack((e) => !e)}
                    label="Sound Profile"
                  />
                    </div>
                  </Section>

                  {/* Pedigree: sliders stacked vertically, matching Step 2 styling */}
                  <Section title="Pedigree" icon={Award}>
                    <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-brass-light text-sm">Star Power</span>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={filters.aListCastAny}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              onUpdate(checked ? { aListCastAny: true, aListCast: 50 } : { aListCastAny: false });
                            }}
                            className="rounded border-brass/50 bg-cherry-900 accent-[#B8860B] focus:ring-brass focus:ring-offset-cherry-900"
                          />
                          <span className="text-cream text-sm">Any</span>
                        </label>
                      </div>
                      <span className="text-cream text-sm tabular-nums">{filters.aListCastAny ? '—' : filters.aListCast}</span>
                    </div>
                    <SteppedRangeTrack
                      value={filters.aListCast}
                      onChange={(v) => onUpdate({ aListCast: v })}
                      disabled={filters.aListCastAny}
                    />
                    <div className="flex justify-between text-xs text-cream">
                      <span>Indie ensembles</span>
                      <span>Star power</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-brass-light text-sm">Director prominence</span>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={filters.directorProminenceAny}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              onUpdate(
                                checked
                                  ? { directorProminenceAny: true, directorProminence: 50 }
                                  : { directorProminenceAny: false }
                              );
                            }}
                            className="rounded border-brass/50 bg-cherry-900 accent-[#B8860B] focus:ring-brass focus:ring-offset-cherry-900"
                          />
                          <span className="text-cream text-sm">Any</span>
                        </label>
                      </div>
                      <span className="text-cream text-sm tabular-nums">{filters.directorProminenceAny ? '—' : filters.directorProminence}</span>
                    </div>
                    <SteppedRangeTrack
                      value={filters.directorProminence}
                      onChange={(v) => onUpdate({ directorProminence: v })}
                      disabled={filters.directorProminenceAny}
                    />
                    <div className="flex justify-between text-xs text-cream">
                      <span>Indie</span>
                      <span>Household names</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-brass-light mb-2">Academy Awards</label>
                    <p className="text-xs text-cream mb-2">Best Picture only. Pick one: Any, Nominee, Winner, or Both (winners + nominees).</p>
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Academy Award Best Picture filter">
                      {(['any', 'nominee', 'winner', 'both'] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          role="radio"
                          aria-checked={filters.oscarFilter === opt}
                          onClick={() => onUpdate({ oscarFilter: opt })}
                          className={`px-3 py-1.5 rounded-sm border-2 text-sm transition-all duration-300 ${
                            filters.oscarFilter === opt ? 'border-brass bg-brass/15 text-neon-gold shadow-[0_0_20px_rgba(184,134,11,0.4)]' : 'border-brass/50 text-cream hover:border-brass hover:text-brass-light'
                          }`}
                        >
                          {opt === 'any' ? 'Any' : opt === 'nominee' ? 'Nominee' : opt === 'winner' ? 'Winner' : 'Both'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-brass-light mb-2">Critics vs. Fans</label>
                    <div className="flex flex-wrap gap-2">
                      {(['any', 'critics', 'fans', 'both'] as const).map((opt) => {
                        const v = opt === 'any' ? null : (opt as CriticsVsFans);
                        const selected = filters.criticsVsFans === v;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => onUpdate({ criticsVsFans: v })}
                            className={`px-3 py-1.5 rounded-sm border-2 text-sm transition-all duration-300 ${
                              selected ? 'border-brass bg-brass/15 text-neon-gold shadow-[0_0_20px_rgba(184,134,11,0.4)]' : 'border-brass/50 text-cream hover:border-brass hover:text-brass-light'
                            }`}
                          >
                            {opt === 'any' ? 'Any' : opt === 'both' ? 'Top Rated' : opt === 'critics' ? 'Critics' : 'Fans'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                    </div>
                  </Section>
                </div>
              </div>
              </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
