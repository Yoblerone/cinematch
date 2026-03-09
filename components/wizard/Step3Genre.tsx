'use client';

import { motion } from 'framer-motion';
import { Film } from 'lucide-react';
import type { Genre } from '@/lib/types';
import { GENRE_OPTIONS } from '@/lib/optionSets';

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
          : 'border-brass/50 text-cherry-600 hover:border-brass hover:text-brass-light'
      }`}
    >
      <span className="relative z-10">{children}</span>
    </button>
  );
}

interface Step3GenreProps {
  genre: Genre | null;
  onGenreChange: (g: Genre | null) => void;
}

export default function Step3Genre({ genre, onGenreChange }: Step3GenreProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-8"
    >
      <div className="text-center">
        <h2 className="text-3xl font-display font-semibold text-neon-gold text-neon-glow mb-2">
          Genre
        </h2>
        <p className="text-cherry-600 text-sm">What kind of film?</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3 max-w-2xl mx-auto">
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
    </motion.div>
  );
}
