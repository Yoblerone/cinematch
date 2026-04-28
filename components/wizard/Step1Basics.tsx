'use client';

import { motion } from 'framer-motion';
import { Film, Calendar, Clock, Globe } from 'lucide-react';
import type { Genre, Decade, Runtime } from '@/lib/types';
import { GENRE_OPTIONS } from '@/lib/optionSets';
import { MAX_GENRES } from '@/lib/types';
import StepResetButton from './StepResetButton';

const DECADE_OPTIONS: { value: Decade & {}; label: string }[] = [
  { value: '60s', label: '60s' },
  { value: '70s', label: '70s' },
  { value: '80s', label: '80s' },
  { value: '90s', label: '90s' },
  { value: '2000s', label: '2000s' },
  { value: '2010s', label: '2010s' },
  { value: '2020s', label: '2020s' },
];

const RUNTIME_OPTIONS: { value: Runtime; label: string }[] = [
  { value: null, label: 'Any' },
  { value: 'short', label: 'Short (<90 min)' },
  { value: 'medium', label: 'Medium (90–150 min)' },
  { value: 'long', label: 'Long (2.5 hr+)' },
];

function Chip({
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
      className={`relative px-4 py-2.5 border-2 text-sm font-medium transition-all duration-300 rounded-sm ${
        selected
          ? 'border-brass bg-brass/15 text-neon-gold shadow-[0_0_20px_rgba(184,134,11,0.4)]'
          : 'border-brass/50 text-cream hover:border-brass hover:text-brass-light'
      }`}
    >
      {children}
    </button>
  );
}

interface Step1BasicsProps {
  genre: Genre[];
  decade: (Decade & {})[];
  runtime: Runtime;
  originCountry: 'us' | 'international-english' | 'international-nonenglish' | null;
  onGenreChange: (g: Genre[]) => void;
  onDecadeChange: (d: (Decade & {})[]) => void;
  onRuntimeChange: (r: Runtime) => void;
  onOriginCountryChange: (c: 'us' | 'international-english' | 'international-nonenglish' | null) => void;
  onResetStep?: () => void;
}

export default function Step1Basics({
  genre,
  decade,
  runtime,
  originCountry,
  onGenreChange,
  onDecadeChange,
  onRuntimeChange,
  onOriginCountryChange,
  onResetStep,
}: Step1BasicsProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-8"
    >
      <div className="text-center">
        <h2 className="text-3xl font-display font-semibold text-neon-gold text-neon-glow mb-2">
          The Basics
        </h2>
        {onResetStep && <StepResetButton onReset={onResetStep} />}
      </div>

      <div className="space-y-6 max-w-2xl mx-auto">
        <div>
          <div className="flex items-center gap-2 text-brass-light mb-3">
            <Film className="w-5 h-5" />
            <span className="font-medium">Genre</span>
            <span className="text-cream text-xs">(up to {MAX_GENRES})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip selected={genre.length === 0} onClick={() => onGenreChange([])}>Any</Chip>
            {GENRE_OPTIONS.map((g) => {
              const selected = genre.includes(g);
              return (
                <Chip
                  key={g}
                  selected={selected}
                  onClick={() => {
                    if (selected) onGenreChange(genre.filter((x) => x !== g));
                    else if (genre.length < MAX_GENRES) onGenreChange([...genre, g]);
                  }}
                >
                  {g}
                </Chip>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 text-brass-light mb-3">
            <Calendar className="w-5 h-5" />
            <span className="font-medium">Decade</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {DECADE_OPTIONS.map(({ value, label }) => {
              const selected = decade.includes(value);
              return (
                <Chip
                  key={label}
                  selected={selected}
                  onClick={() => {
                    if (selected) onDecadeChange(decade.filter((d) => d !== value));
                    else onDecadeChange([...decade, value]);
                  }}
                >
                  {label}
                </Chip>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 text-brass-light mb-3">
            <Clock className="w-5 h-5" />
            <span className="font-medium">Runtime</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {RUNTIME_OPTIONS.map(({ value, label }) => (
              <Chip
                key={label}
                selected={runtime === value}
                onClick={() => onRuntimeChange(value)}
              >
                {label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 text-brass-light mb-3">
            <Globe className="w-5 h-5" />
            <span className="font-medium">Origin</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip
              selected={originCountry === 'international-english'}
              onClick={() => onOriginCountryChange(originCountry === 'international-english' ? null : 'international-english')}
            >
              International (English)
            </Chip>
            <Chip
              selected={originCountry === 'international-nonenglish'}
              onClick={() => onOriginCountryChange(originCountry === 'international-nonenglish' ? null : 'international-nonenglish')}
            >
              International (Non-English)
            </Chip>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
