'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Palette, Music, Film, Tag, RefreshCw, Undo2, Redo2 } from 'lucide-react';
import type { VisualStyle, Soundtrack, Genre, Theme } from '@/lib/types';
import {
  VISUAL_STYLE_SETS,
  SOUNDTRACK_SETS,
  THEME_SETS,
  DEFAULT_VISUAL_STYLE_OPTIONS,
  DEFAULT_SOUNDTRACK_OPTIONS,
  DEFAULT_THEME_OPTIONS,
  GENRE_OPTIONS,
} from '@/lib/optionSets';

interface Step3AestheticProps {
  genre: Genre | null;
  theme: Theme[];
  visualStyle: VisualStyle[];
  soundtrack: Soundtrack[];
  onGenreChange: (g: Genre | null) => void;
  onThemeToggle: (t: Theme) => void;
  onVisualStyleToggle: (v: VisualStyle) => void;
  onSoundtrackToggle: (v: Soundtrack) => void;
}

function FilmFrameChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative px-4 py-2.5 border-2 text-sm font-medium transition-all duration-300 rounded-sm before:absolute before:inset-0 before:rounded-sm before:border before:border-brass/40 before:pointer-events-none before:scale-[0.97] ${
        selected
          ? 'border-brass bg-brass/15 text-neon-gold shadow-[0_0_20px_rgba(184,134,11,0.4)]'
          : 'border-brass/50 text-cream hover:border-brass hover:text-brass-light'
      }`}
    >
      <span className="relative z-10">{children}</span>
    </button>
  );
}

function OptionSectionWithRegenerate<T extends string>({
  title,
  icon: Icon,
  currentOptions,
  selected,
  onToggle,
  onRegenerate,
  onPrevious,
  onNext,
  canGoPrevious,
  canGoNext,
  currentLabel,
}: {
  title: string;
  icon: React.ElementType;
  currentOptions: T[];
  selected: T[];
  onToggle: (v: T) => void;
  onRegenerate: () => void;
  onPrevious: () => void;
  onNext: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
  currentLabel: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-brass-light">
          <Icon className="w-5 h-5" />
          <span className="font-medium">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {canGoPrevious && (
            <button
              type="button"
              onClick={onPrevious}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-brass/50 text-cream text-xs hover:border-brass hover:text-brass-light transition-all"
              title="Previous generation"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Previous
            </button>
          )}
          {canGoNext && (
            <button
              type="button"
              onClick={onNext}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-brass/50 text-cream text-xs hover:border-brass hover:text-brass-light transition-all"
              title="Next generation"
            >
              <Redo2 className="w-3.5 h-3.5" />
              Next
            </button>
          )}
          <button
            type="button"
            onClick={onRegenerate}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-brass/50 text-cream text-xs hover:border-brass hover:text-brass-light transition-all"
            title="Show new options (only ones not shown yet)"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Regenerate
          </button>
        </div>
      </div>
      {currentLabel && (
        <p className="text-xs text-cream">Showing: {currentLabel}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {currentOptions.map((v) => (
          <FilmFrameChip key={v} selected={selected.includes(v)} onClick={() => onToggle(v)}>
            {v}
          </FilmFrameChip>
        ))}
      </div>
    </div>
  );
}

export default function Step3Aesthetic({
  genre,
  theme,
  visualStyle,
  soundtrack,
  onGenreChange,
  onThemeToggle,
  onVisualStyleToggle,
  onSoundtrackToggle,
}: Step3AestheticProps) {
  // Generations = list of set indices we've visited. Regenerate adds a NEW set index (not seen before).
  const [visualGenerations, setVisualGenerations] = useState<number[]>([0]);
  const [visualIndex, setVisualIndex] = useState(0);
  const [soundtrackGenerations, setSoundtrackGenerations] = useState<number[]>([0]);
  const [soundtrackIndex, setSoundtrackIndex] = useState(0);
  const [themeGenerations, setThemeGenerations] = useState<number[]>([0]);
  const [themeIndex, setThemeIndex] = useState(0);

  // Clamp indices so "Set #" never exceeds actual generations; Next only when there's a forward
  const safeVisualIndex = Math.min(visualIndex, visualGenerations.length - 1);
  const safeSoundtrackIndex = Math.min(soundtrackIndex, soundtrackGenerations.length - 1);
  const safeThemeIndex = Math.min(themeIndex, themeGenerations.length - 1);

  const currentVisualSet = VISUAL_STYLE_SETS[visualGenerations[safeVisualIndex]] ?? DEFAULT_VISUAL_STYLE_OPTIONS;
  const currentSoundtrackSet = SOUNDTRACK_SETS[soundtrackGenerations[safeSoundtrackIndex]] ?? DEFAULT_SOUNDTRACK_OPTIONS;
  const currentThemeSet = THEME_SETS[themeGenerations[safeThemeIndex]] ?? DEFAULT_THEME_OPTIONS;

  const pickNextUnseen = useCallback((current: number[], poolSize: number): number => {
    for (let i = 0; i < poolSize; i++) if (!current.includes(i)) return i;
    return 0; // all seen → cycle
  }, []);

  const handleVisualRegenerate = useCallback(() => {
    const next = pickNextUnseen(visualGenerations, VISUAL_STYLE_SETS.length);
    setVisualGenerations((g) => [...g, next]);
    setVisualIndex((g) => g + 1);
  }, [visualGenerations]);

  const handleVisualPrevious = useCallback(() => {
    setVisualIndex((i) => Math.max(0, i - 1));
  }, []);

  const handleVisualNext = useCallback(() => {
    setVisualIndex((i) => Math.min(visualGenerations.length - 1, i + 1));
  }, [visualGenerations.length]);

  const handleSoundtrackRegenerate = useCallback(() => {
    const next = pickNextUnseen(soundtrackGenerations, SOUNDTRACK_SETS.length);
    setSoundtrackGenerations((g) => [...g, next]);
    setSoundtrackIndex((g) => g + 1);
  }, [soundtrackGenerations]);

  const handleSoundtrackPrevious = useCallback(() => {
    setSoundtrackIndex((i) => Math.max(0, i - 1));
  }, []);

  const handleSoundtrackNext = useCallback(() => {
    setSoundtrackIndex((i) => Math.min(soundtrackGenerations.length - 1, i + 1));
  }, [soundtrackGenerations.length]);

  const handleThemeRegenerate = useCallback(() => {
    const next = pickNextUnseen(themeGenerations, THEME_SETS.length);
    setThemeGenerations((g) => [...g, next]);
    setThemeIndex((g) => g + 1);
  }, [themeGenerations]);

  const handleThemePrevious = useCallback(() => {
    setThemeIndex((i) => Math.max(0, i - 1));
  }, []);

  const handleThemeNext = useCallback(() => {
    setThemeIndex((i) => Math.min(themeGenerations.length - 1, i + 1));
  }, [themeGenerations.length]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-8"
    >
      <div className="text-center">
        <h2 className="text-3xl font-display font-semibold text-neon-gold text-neon-glow mb-2">
          The Aesthetic
        </h2>
      </div>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-brass-light">
            <Film className="w-5 h-5" />
            <span className="font-medium">Genre</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <FilmFrameChip selected={genre === null} onClick={() => onGenreChange(null)}>
              Any
            </FilmFrameChip>
            {GENRE_OPTIONS.map((g) => (
              <FilmFrameChip
                key={g}
                selected={genre === g}
                onClick={() => onGenreChange(genre === g ? null : g)}
              >
                {g}
              </FilmFrameChip>
            ))}
          </div>
        </div>

        <OptionSectionWithRegenerate
          title="Theme / Mood"
          icon={Tag}
          currentOptions={currentThemeSet}
          currentLabel={`Set ${safeThemeIndex + 1}`}
          selected={theme}
          onToggle={onThemeToggle}
          onRegenerate={handleThemeRegenerate}
          onPrevious={handleThemePrevious}
          onNext={handleThemeNext}
          canGoPrevious={safeThemeIndex > 0}
          canGoNext={themeIndex < themeGenerations.length - 1}
        />

        <OptionSectionWithRegenerate
          title="Visual Style"
          icon={Palette}
          currentOptions={currentVisualSet}
          currentLabel={`Set ${safeVisualIndex + 1}`}
          selected={visualStyle}
          onToggle={onVisualStyleToggle}
          onRegenerate={handleVisualRegenerate}
          onPrevious={handleVisualPrevious}
          onNext={handleVisualNext}
          canGoPrevious={safeVisualIndex > 0}
          canGoNext={visualIndex < visualGenerations.length - 1}
        />

        <OptionSectionWithRegenerate
          title="Soundtrack"
          icon={Music}
          currentOptions={currentSoundtrackSet}
          currentLabel={`Set ${safeSoundtrackIndex + 1}`}
          selected={soundtrack}
          onToggle={onSoundtrackToggle}
          onRegenerate={handleSoundtrackRegenerate}
          onPrevious={handleSoundtrackPrevious}
          onNext={handleSoundtrackNext}
          canGoPrevious={safeSoundtrackIndex > 0}
          canGoNext={soundtrackIndex < soundtrackGenerations.length - 1}
        />
      </div>
    </motion.div>
  );
}
