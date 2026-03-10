'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Music, Tag, ChevronLeft, ChevronRight } from 'lucide-react';
import type { VisualStyle, Soundtrack, Theme } from '@/lib/types';
import {
  VISUAL_STYLE_SETS,
  SOUNDTRACK_SETS,
  THEME_SETS,
  TAGS_PER_PAGE,
} from '@/lib/optionSets';

interface Step4AestheticProps {
  theme: Theme[];
  visualStyle: VisualStyle[];
  soundtrack: Soundtrack[];
  onThemeToggle: (t: Theme) => void;
  onVisualStyleToggle: (v: VisualStyle) => void;
  onSoundtrackToggle: (v: Soundtrack) => void;
}

/** Tag chip: same styling as The Basics — brass border, cream text; selected = brass bg + neon-gold. */
function TagChip<T extends string>({
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
      className={`tag-chip h-9 px-2 py-1 text-sm font-medium transition-all duration-300 rounded-sm border-2 truncate ${
        selected
          ? 'border-brass bg-brass/15 text-neon-gold shadow-[0_0_20px_rgba(184,134,11,0.4)]'
          : 'border-brass/50 text-cream hover:border-brass hover:text-brass-light'
      }`}
    >
      {children}
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
  const pageOptions = allSets[safeIndex] ?? allSets[0] ?? [];
  const padded = [...pageOptions, ...Array(Math.max(0, TAGS_PER_PAGE - pageOptions.length)).fill(null)] as (T | null)[];
  const canGoPrevious = safeIndex > 0;
  const canGoNext = safeIndex < total - 1;
  const [direction, setDirection] = useState(0);

  const goPrev = () => {
    setDirection(-1);
    onPrevious();
  };
  const goNext = () => {
    setDirection(1);
    onNext();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-brass-light">
          <Icon className="w-5 h-5" />
          <span className="font-medium">{title}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-nowrap">
          <button
            type="button"
            onClick={goPrev}
            disabled={!canGoPrevious}
            className={`p-1.5 rounded-sm border-2 transition-all touch-manipulation border-brass/50 text-cream
              ${canGoPrevious ? 'hover:border-brass hover:bg-brass/10 hover:text-brass-light' : 'opacity-50 cursor-not-allowed'}`}
            title="Previous 6"
            aria-label="Previous 6"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-cream tabular-nums min-w-[2.5rem] text-center">
            {safeIndex + 1} / {total}
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={!canGoNext}
            className={`p-1.5 rounded-sm border-2 transition-all touch-manipulation border-brass/50 text-cream
              ${canGoNext ? 'hover:border-brass hover:bg-brass/10 hover:text-brass-light' : 'opacity-50 cursor-not-allowed'}`}
            title="Next 6"
            aria-label="Next 6"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="aesthetic-chip-grid relative overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={safeIndex}
            custom={direction}
            initial={{ opacity: 0, x: direction === 1 ? 60 : direction === -1 ? -60 : 0 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction === 1 ? -60 : direction === -1 ? 60 : 0 }}
            transition={{ duration: 0.2 }}
            className="grid gap-0.375rem gap-x-2 grid-cols-3 grid-rows-2 w-full absolute inset-0"
            style={{ gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 2.25rem)' }}
          >
            {padded.slice(0, TAGS_PER_PAGE).map((v, i) =>
              v != null ? (
                <TagChip key={v} selected={selected.includes(v)} onClick={() => onToggle(v)}>
                  {v}
                </TagChip>
              ) : (
                <div key={`empty-${i}`} className="min-w-0" aria-hidden />
              )
            )}
          </motion.div>
        </AnimatePresence>
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
      className="space-y-6"
    >
      <div className="text-center">
        <h2 className="text-3xl font-display font-semibold text-neon-gold text-neon-glow mb-2">
          The Aesthetic
        </h2>
        <p className="text-cream text-sm">Theme, visual style & sound</p>
      </div>
      <div className="scroll-area-slate space-y-5 max-w-2xl mx-auto max-h-[65vh] overflow-y-auto py-1">
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
          title="Sound Profile"
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
