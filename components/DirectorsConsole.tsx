'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlidersHorizontal, X, Plus, Minus, RotateCw, Film, Zap, Palette, Award } from 'lucide-react';
import FilterLegend from './FilterLegend';
import { RankIcon, FilterIcon } from './FilterTypeIcon';
import type { FilterState, VisualStyle, Soundtrack, Genre, Theme, CriticsVsFans, Decade, Runtime } from '@/lib/types';
import { MAX_GENRES } from '@/lib/types';
import { ALL_VISUAL_STYLE_OPTIONS, ALL_SOUNDTRACK_OPTIONS, ALL_THEME_OPTIONS, GENRE_OPTIONS } from '@/lib/optionSets';

const SLIDER_CONFIG = [
  { key: 'pacing' as const, label: 'Pacing', low: 'Slow Burn', high: 'Breakneck' },
  { key: 'cryMeter' as const, label: 'Cry Meter', low: 'Cool / Unmoved', high: 'Tissues' },
  { key: 'humor' as const, label: 'Humor', low: 'Dead Serious', high: 'Slapstick' },
  { key: 'romance' as const, label: 'Romance', low: 'None', high: 'Full-on' },
  { key: 'suspense' as const, label: 'Suspense', low: 'Calm', high: 'White-knuckle' },
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
              className={`px-3 py-1.5 rounded border text-sm ${
                selected ? 'border-brass bg-brass/20 text-neon-gold' : 'border-brass/50 text-cream'
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
            className="flex items-center justify-center w-8 h-8 rounded border border-brass/50 text-cream hover:border-brass hover:text-brass-light transition-all"
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
    <section className="rounded-xl border-2 border-brass/40 bg-cherry-900/30 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-brass/40 bg-cherry-900/50">
        <Icon className="w-5 h-5 text-brass" />
        <h3 className="text-sm font-display font-semibold text-neon-gold uppercase tracking-wide">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default function DirectorsConsole({ filters, onUpdate, onOpenChange, onRefresh }: DirectorsConsoleProps) {
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
        className="fixed bottom-6 right-6 z-[45] flex items-center gap-2 px-5 py-3 rounded-xl border-2 border-brass bg-cherry-900 text-neon-gold shadow-brass hover:bg-brass/20 transition-all font-medium"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        aria-label="Open Director's Slate"
      >
        <SlidersHorizontal className="w-5 h-5" />
        Director&apos;s Slate
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
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', damping: 25 }}
              className="fixed inset-4 z-[50] sm:inset-6 md:inset-8 flex flex-col rounded-xl border-2 border-brass bg-cherry-950 shadow-neon-glow overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-brass/40 bg-cherry-900/50">
                <h2 className="text-xl font-display font-semibold text-neon-gold text-neon-glow">
                  Director&apos;s Slate
                </h2>
                <div className="flex items-center gap-2">
                  {typeof onRefresh === 'function' && (
                    <button
                      type="button"
                      onClick={() => { onRefresh?.(); closeModal(); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-brass/50 text-brass-light hover:border-brass hover:bg-brass/10 transition-all text-sm font-medium"
                    >
                      <RotateCw className="w-4 h-4" />
                      Refresh results
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeModal}
                    className="p-2 rounded-lg border border-brass/50 text-brass-light hover:bg-brass/10"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto scroll-area-slate p-6">
                <div className="max-w-4xl mx-auto space-y-6">
                  <FilterLegend className="mb-2" />
                  {/* The Basics */}
                  <Section title="The Basics" icon={Film}>
                    <div className="grid sm:grid-cols-2 gap-6">
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
                    icon={<FilterIcon />}
                  />
                  <div>
                    <label className="block text-sm font-medium text-brass-light mb-2 flex items-center gap-1.5"><FilterIcon /> Decade</label>
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
                            className={`px-3 py-1.5 rounded border text-sm ${
                              selected ? 'border-brass bg-brass/20 text-neon-gold' : 'border-brass/50 text-cream'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-brass-light mb-2 flex items-center gap-1.5"><FilterIcon /> Runtime</label>
                    <div className="flex gap-2">
                      {([null, 'short', 'medium', 'long'] as const).map((v) => (
                        <button
                          key={String(v)}
                          type="button"
                          onClick={() => onUpdate({ runtime: v })}
                          className={`px-3 py-1.5 rounded border text-sm ${
                            filters.runtime === v ? 'border-brass bg-brass/20 text-neon-gold' : 'border-brass/50 text-cream'
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
                    <div className="mb-4 rounded-lg border-l-2 border-brass/60 bg-cherry-900 px-3 py-2">
                      <p className="text-sm text-brass-light/95">Sliders rank results: movies closer to your setting score higher and appear first. They don’t exclude movies.</p>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                  {SLIDER_CONFIG.map(({ key, label, low, high }) => (
                    <div key={key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-brass-light text-sm flex items-center gap-1.5"><RankIcon /> {label}</span>
                        <span className="text-cream text-sm">{filters[key]}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={filters[key]}
                        onChange={(e) => onUpdate({ [key]: Number(e.target.value) })}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-cream">
                        <span>{low}</span>
                        <span>{high}</span>
                      </div>
                    </div>
                  ))}
                    </div>
                  </Section>

                  {/* Aesthetic – theme, visual style, soundtrack: scoring-only; matches rank higher */}
                  <Section title="Aesthetic" icon={Palette}>
                    <div className="mb-4 rounded-lg border-l-2 border-brass/60 bg-cherry-900 px-3 py-2">
                      <p className="text-sm text-brass-light/95">Theme, visual style, and soundtrack don’t exclude movies—they boost ranking. Picks that match your tags appear higher in the list.</p>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-6">
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
                    icon={<RankIcon />}
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
                    icon={<RankIcon />}
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
                    label="Soundtrack"
                    icon={<RankIcon />}
                  />
                    </div>
                  </Section>

                  {/* Pedigree */}
                  <Section title="Pedigree" icon={Award}>
                    <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-brass-light mb-2 flex items-center gap-1.5"><FilterIcon /> Cult Classic</label>
                    <div className="flex gap-2">
                      {([null, true, false] as const).map((v) => (
                        <button
                          key={String(v)}
                          type="button"
                          onClick={() => onUpdate({ cultClassic: v })}
                          className={`px-3 py-1.5 rounded border text-sm ${
                            filters.cultClassic === v ? 'border-brass bg-brass/20 text-neon-gold' : 'border-brass/50 text-cream'
                          }`}
                        >
                          {v == null ? 'Any' : v ? 'Yes' : 'No'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-brass-light mb-2 flex items-center gap-1.5"><FilterIcon /> A-List Cast</label>
                    <div className="flex gap-2">
                      {([null, true, false] as const).map((v) => (
                        <button
                          key={String(v)}
                          type="button"
                          onClick={() => onUpdate({ aListCast: v })}
                          className={`px-3 py-1.5 rounded border text-sm ${
                            filters.aListCast === v ? 'border-brass bg-brass/20 text-neon-gold' : 'border-brass/50 text-cream'
                          }`}
                        >
                          {v == null ? 'Any' : v ? 'Yes' : 'No'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-brass-light mb-2 flex items-center gap-1.5"><FilterIcon /> Critics vs. Fans</label>
                    <div className="flex flex-wrap gap-2">
                      {(['any', 'critics', 'fans', 'both'] as const).map((opt) => {
                        const v = opt === 'any' ? null : (opt as CriticsVsFans);
                        const selected = filters.criticsVsFans === v;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => onUpdate({ criticsVsFans: v })}
                            className={`px-3 py-1.5 rounded border text-sm ${
                              selected ? 'border-brass bg-brass/20 text-neon-gold' : 'border-brass/50 text-cream'
                            }`}
                          >
                            {opt === 'any' ? 'Any' : opt === 'both' ? 'Both' : opt === 'critics' ? 'Critics' : 'Fans'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-brass-light mb-2 flex items-center gap-1.5"><FilterIcon /> Academy Awards</label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-cream">Best Picture winner:</span>
                        {([null, true, false] as const).map((v) => (
                          <button
                            key={`winner-${String(v)}`}
                            type="button"
                            onClick={() => onUpdate({ oscarWinner: v })}
                            className={`px-3 py-1.5 rounded border text-sm ${
                              filters.oscarWinner === v ? 'border-brass bg-brass/20 text-neon-gold' : 'border-brass/50 text-cream'
                            }`}
                          >
                            {v == null ? 'Any' : v ? 'Yes' : 'No'}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-cream">Best Picture nominee:</span>
                        {([null, true, false] as const).map((v) => (
                          <button
                            key={`nominee-${String(v)}`}
                            type="button"
                            onClick={() => onUpdate({ oscarNominee: v })}
                            className={`px-3 py-1.5 rounded border text-sm ${
                              filters.oscarNominee === v ? 'border-brass bg-brass/20 text-neon-gold' : 'border-brass/50 text-cream'
                            }`}
                          >
                            {v == null ? 'Any' : v ? 'Yes' : 'No'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <label className="font-medium text-brass-light text-sm flex items-center gap-1.5"><RankIcon /> Director prominence</label>
                      <span className="text-cream text-sm">{filters.directorProminence}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={filters.directorProminence}
                      onChange={(e) => onUpdate({ directorProminence: Number(e.target.value) })}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-cream">
                      <span>Any</span>
                      <span>Household names</span>
                    </div>
                  </div>
                    </div>
                  </Section>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
