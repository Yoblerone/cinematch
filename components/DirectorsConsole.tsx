'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlidersHorizontal, X, Plus, Minus, RotateCcw, Film, Zap, Award, Trophy, ThumbsUp } from 'lucide-react';
import type { FilterState, Genre, CriticsVsFans, Decade, Runtime } from '@/lib/types';
import { MAX_GENRES } from '@/lib/types';
import { GENRE_OPTIONS } from '@/lib/optionSets';
import { FILTER_WEIGHT_LOW } from '@/lib/filterWeightSegments';
import EnergySliderRow from '@/components/wizard/EnergySliderRow';

const SLIDER_CONFIG = [
  { key: 'narrative_pacing' as const, label: 'Narrative Pacing', optionLabels: { low: 'Slow', high: 'Fast' } },
  { key: 'emotional_tone' as const, label: 'Emotional Tone', optionLabels: { low: 'Light', high: 'Heavy' } },
  { key: 'brain_power' as const, label: 'Brain Power', optionLabels: { low: 'Low', high: 'High' } },
  { key: 'visual_style' as const, label: 'Visual Style', optionLabels: { low: 'Intimate', mid: 'Cinematic', high: 'Epic' } },
  { key: 'suspense_level' as const, label: 'Suspense Level', optionLabels: { low: 'Relaxed', high: 'Tense' } },
  { key: 'world_style' as const, label: 'World Style', optionLabels: { low: 'Grounded', mid: 'Stylized', high: 'Surreal' } },
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
  const pedigreeChipBase =
    'flex-1 min-w-0 basis-0 min-h-[44px] rounded-sm border-2 text-sm font-medium transition-all duration-300 touch-manipulation px-3 py-2 flex items-center justify-center text-center';
  const [open, setOpen] = useState(false);
  const [expandedGenre, setExpandedGenre] = useState(false);

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
                  {SLIDER_CONFIG.map(({ key, label, optionLabels }) => (
                    <EnergySliderRow
                      key={key}
                      label={label}
                      optionLabels={optionLabels}
                      value={filters[key]}
                      active={filters[key] != null}
                      onToggleActive={(active) =>
                        onUpdate({ [key]: active ? (key === 'narrative_pacing' ? FILTER_WEIGHT_LOW : 50) : null })
                      }
                      onChange={(v) => onUpdate({ [key]: v })}
                      density="responsive"
                      variant={
                        key === 'narrative_pacing' ||
                        key === 'emotional_tone' ||
                        key === 'brain_power' ||
                        key === 'suspense_level'
                          ? 'pacingBinary'
                          : 'default'
                      }
                    />
                  ))}
                    </div>
                  </Section>

                  <Section title="Pedigree & accolades" icon={Award}>
                    <div className="space-y-6">
                      <div
                        className={`space-y-2 transition-all duration-200 ${
                          filters.aListCast == null ? 'stage-light-off' : 'stage-light-on'
                        }`}
                      >
                        <div className="text-center">
                          <div className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={filters.aListCast != null}
                              aria-label="Toggle Star Power"
                              onClick={() => onUpdate({ aListCast: filters.aListCast == null ? 'high' : null })}
                              className={`filament-switch ${filters.aListCast != null ? 'filament-switch--on' : 'filament-switch--off'}`}
                            />
                            <button
                              type="button"
                              onClick={() => onUpdate({ aListCast: filters.aListCast == null ? 'high' : null })}
                              className={`bg-transparent p-0 text-sm font-medium ${filters.aListCast != null ? 'filament-label-on text-[#FFD700]' : 'text-brass-light'}`}
                              aria-label="Toggle Star Power"
                            >
                              Star Power
                            </button>
                          </div>
                        </div>
                        <div className={filters.aListCast == null ? 'stage-control-off pointer-events-none' : ''}>
                          <div className="flex gap-2" role="radiogroup" aria-label="Star power level">
                            {(['low', 'high'] as const).map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                role="radio"
                                aria-checked={filters.aListCast === opt}
                                onClick={() => onUpdate({ aListCast: opt })}
                                className={`${pedigreeChipBase} ${
                                  filters.aListCast === opt
                                    ? 'border-brass bg-brass/15 text-neon-gold shadow-[0_0_20px_rgba(184,134,11,0.4)]'
                                    : 'border-brass/50 bg-transparent text-cream hover:border-brass hover:text-brass-light'
                                }`}
                              >
                                {opt === 'low' ? 'Low' : 'High'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className={`space-y-2 transition-all duration-200 ${filters.directorProminence == null ? 'stage-light-off' : 'stage-light-on'}`}>
                        <div className="text-center">
                          <div className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={filters.directorProminence != null}
                              aria-label="Toggle Director prominence"
                              onClick={() =>
                                onUpdate({ directorProminence: filters.directorProminence == null ? 'high' : null })
                              }
                              className={`filament-switch ${
                                filters.directorProminence != null ? 'filament-switch--on' : 'filament-switch--off'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                onUpdate({ directorProminence: filters.directorProminence == null ? 'high' : null })
                              }
                              className={`bg-transparent p-0 text-sm font-medium ${filters.directorProminence != null ? 'filament-label-on text-[#FFD700]' : 'text-brass-light'}`}
                              aria-label="Toggle Director prominence"
                            >
                              Director prominence
                            </button>
                          </div>
                        </div>
                        <div className={filters.directorProminence == null ? 'stage-control-off pointer-events-none' : ''}>
                          <div className="flex gap-2" role="radiogroup" aria-label="Director prominence level">
                            {(['low', 'high'] as const).map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                role="radio"
                                aria-checked={filters.directorProminence === opt}
                                onClick={() => onUpdate({ directorProminence: opt })}
                                className={`${pedigreeChipBase} ${
                                  filters.directorProminence === opt
                                    ? 'border-brass bg-brass/15 text-neon-gold shadow-[0_0_20px_rgba(184,134,11,0.4)]'
                                    : 'border-brass/50 bg-transparent text-cream hover:border-brass hover:text-brass-light'
                                }`}
                              >
                                {opt === 'low' ? 'Low' : 'High'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className={`space-y-2 transition-all duration-200 ${filters.oscarFilter == null ? 'stage-light-off' : 'stage-light-on'}`}>
                        <div className="flex items-center justify-center gap-2">
                          <Trophy className="w-5 h-5" />
                          <button
                            type="button"
                            role="switch"
                            aria-checked={filters.oscarFilter != null}
                            aria-label="Toggle Best Picture filter"
                            onClick={() => onUpdate({ oscarFilter: filters.oscarFilter == null ? 'both' : null })}
                            className={`filament-switch ${filters.oscarFilter != null ? 'filament-switch--on' : 'filament-switch--off'}`}
                          />
                          <button
                            type="button"
                            onClick={() => onUpdate({ oscarFilter: filters.oscarFilter == null ? 'both' : null })}
                            className={`block bg-transparent p-0 text-sm font-medium ${filters.oscarFilter != null ? 'filament-label-on text-[#FFD700]' : 'text-brass-light'}`}
                            aria-label="Toggle Best Picture filter"
                          >
                            Best Picture
                          </button>
                        </div>
                        <div className={filters.oscarFilter == null ? 'pointer-events-none stage-control-off' : ''}>
                          <div className="flex gap-2" role="radiogroup" aria-label="Academy Award Best Picture filter">
                            {(['nominee', 'winner', 'both'] as const).map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                role="radio"
                                aria-checked={filters.oscarFilter === opt}
                                onClick={() => onUpdate({ oscarFilter: opt })}
                                className={`${pedigreeChipBase} ${
                                  filters.oscarFilter === opt
                                    ? 'border-brass bg-brass/15 text-neon-gold shadow-[0_0_20px_rgba(184,134,11,0.4)]'
                                    : 'border-brass/50 bg-transparent text-cream hover:border-brass hover:text-brass-light'
                                }`}
                              >
                                {opt === 'nominee' ? 'Nominee' : opt === 'winner' ? 'Winner' : 'Both'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className={`space-y-2 transition-all duration-200 ${filters.criticsVsFans == null ? 'stage-light-off' : 'stage-light-on'}`}>
                        <div className="flex items-center justify-center gap-2">
                          <ThumbsUp className="w-5 h-5 text-brass-light" />
                          <button
                            type="button"
                            role="switch"
                            aria-checked={filters.criticsVsFans != null}
                            aria-label="Toggle Critics vs. Fans filter"
                            onClick={() => onUpdate({ criticsVsFans: filters.criticsVsFans == null ? 'both' : null })}
                            className={`filament-switch ${filters.criticsVsFans != null ? 'filament-switch--on' : 'filament-switch--off'}`}
                          />
                          <button
                            type="button"
                            onClick={() => onUpdate({ criticsVsFans: filters.criticsVsFans == null ? 'both' : null })}
                            className={`block bg-transparent p-0 text-sm font-medium ${filters.criticsVsFans != null ? 'filament-label-on text-[#FFD700]' : 'text-brass-light'}`}
                            aria-label="Toggle Critics vs. Fans filter"
                          >
                            Critics vs. Fans
                          </button>
                        </div>
                        <div className={filters.criticsVsFans == null ? 'pointer-events-none stage-control-off' : ''}>
                          <div className="flex gap-2">
                          {(['critics', 'fans', 'both'] as const).map((opt) => {
                            const selected = filters.criticsVsFans === opt;
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => onUpdate({ criticsVsFans: opt })}
                                className={`${pedigreeChipBase} ${
                                  selected
                                    ? 'border-brass bg-brass/15 text-neon-gold shadow-[0_0_20px_rgba(184,134,11,0.4)]'
                                    : 'border-brass/50 bg-transparent text-cream hover:border-brass hover:text-brass-light'
                                }`}
                              >
                                {opt === 'both' ? 'Top Rated' : opt === 'critics' ? 'Critics' : 'Fans'}
                              </button>
                            );
                          })}
                          </div>
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
