'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Palette, Music, Tag, Undo2, Redo2 } from 'lucide-react';
import type { VisualStyle, Soundtrack, Theme } from '@/lib/types';
import {
  VISUAL_STYLE_SETS,
  SOUNDTRACK_SETS,
  THEME_SETS,
} from '@/lib/optionSets';

interface Step4AestheticProps {
  theme: Theme[];
  visualStyle: VisualStyle[];
  soundtrack: Soundtrack[];
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
      className={`relative w-full min-w-0 sm:min-w-[7.5rem] max-w-[11rem] h-10 px-3 py-2 border-2 text-sm font-medium transition-all duration-300 rounded-sm truncate before:absolute before:inset-0 before:rounded-sm before:border before:border-brass/40 before:pointer-events-none before:scale-[0.97] touch-manipulation ${
        selected
          ? 'border-brass bg-brass/15 text-neon-gold shadow-[0_0_20px_rgba(184,134,11,0.4)]'
          : 'border-brass/50 text-cherry-600 hover:border-brass hover:text-brass-light'
      }`}
    >
      <span className="relative z-10 block truncate text-left">{children}</span>
    </button>
  );
}

function OptionSection<T extends string>({
  title,
  icon: Icon,
  allSets,
  currentIndex,
  selected,
  onToggle,
  onPrevious,
  onNext,
}: {
  title: string;
  icon: React.ElementType;
  allSets: T[][];
  currentIndex: number;
  selected: T[];
  onToggle: (v: T) => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const total = allSets.length;
  const safeIndex = Math.min(Math.max(0, currentIndex), total - 1);
  const currentOptions = allSets[safeIndex] ?? allSets[0];
  const canGoPrevious = safeIndex > 0;
  const canGoNext = safeIndex < total - 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-brass-light">
          <Icon className="w-5 h-5" />
          <span className="font-medium">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrevious}
            disabled={!canGoPrevious}
            className={`flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded border text-xs transition-all touch-manipulation ${
              canGoPrevious
                ? 'border-brass/50 text-cherry-600 hover:border-brass hover:text-brass-light'
                : 'border-brass/30 text-cherry-700/50 cursor-not-allowed opacity-50'
            }`}
            title="Previous set"
          >
            <Undo2 className="w-3.5 h-3.5" />
            Previous
          </button>
          <span className="text-xs text-cherry-600 tabular-nums">
            {safeIndex + 1} / {total}
          </span>
          <button
            type="button"
            onClick={onNext}
            disabled={!canGoNext}
            className={`flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded border text-xs transition-all touch-manipulation ${
              canGoNext
                ? 'border-brass/50 text-cherry-600 hover:border-brass hover:text-brass-light'
                : 'border-brass/30 text-cherry-700/50 cursor-not-allowed opacity-50'
            }`}
            title="Next set"
          >
            Next
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="aesthetic-chip-grid">
        {currentOptions.map((v) => (
          <FilmFrameChip key={v} selected={selected.includes(v)} onClick={() => onToggle(v)}>
            {v}
          </FilmFrameChip>
        ))}
      </div>
    </div>
  );
}

export default function Step4Aesthetic({
  theme,
  visualStyle,
  soundtrack,
  onThemeToggle,
  onVisualStyleToggle,
  onSoundtrackToggle,
}: Step4AestheticProps) {
  const [themeIndex, setThemeIndex] = useState(0);
  const [visualIndex, setVisualIndex] = useState(0);
  const [soundtrackIndex, setSoundtrackIndex] = useState(0);

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
      <div className="rounded-lg border-l-2 border-brass/60 bg-cherry-900/60 px-3 py-2 mb-6 max-w-3xl mx-auto">
        <p className="text-sm text-brass-light/95">Theme, visual style, and soundtrack don’t exclude movies—they boost ranking. Picks that match your tags appear higher in the list.</p>
      </div>
      <div className="scroll-area-slate space-y-6 max-w-3xl mx-auto max-h-[65vh] overflow-y-auto">
        <OptionSection
          title="Theme / Mood"
          icon={Tag}
          allSets={THEME_SETS}
          currentIndex={themeIndex}
          selected={theme}
          onToggle={onThemeToggle}
          onPrevious={() => setThemeIndex((i) => Math.max(0, i - 1))}
          onNext={() => setThemeIndex((i) => Math.min(THEME_SETS.length - 1, i + 1))}
        />

        <OptionSection
          title="Visual Style"
          icon={Palette}
          allSets={VISUAL_STYLE_SETS}
          currentIndex={visualIndex}
          selected={visualStyle}
          onToggle={onVisualStyleToggle}
          onPrevious={() => setVisualIndex((i) => Math.max(0, i - 1))}
          onNext={() => setVisualIndex((i) => Math.min(VISUAL_STYLE_SETS.length - 1, i + 1))}
        />

        <OptionSection
          title="Soundtrack"
          icon={Music}
          allSets={SOUNDTRACK_SETS}
          currentIndex={soundtrackIndex}
          selected={soundtrack}
          onToggle={onSoundtrackToggle}
          onPrevious={() => setSoundtrackIndex((i) => Math.max(0, i - 1))}
          onNext={() => setSoundtrackIndex((i) => Math.min(SOUNDTRACK_SETS.length - 1, i + 1))}
        />
      </div>
    </motion.div>
  );
}
