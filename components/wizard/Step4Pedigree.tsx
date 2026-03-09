'use client';

import { motion } from 'framer-motion';
import { Star, Award, ThumbsUp, Trophy, Clapperboard } from 'lucide-react';
import { FilterIcon, RankIcon } from '../FilterTypeIcon';
import type { CriticsVsFans } from '@/lib/types';

interface Step4PedigreeProps {
  cultClassic: boolean | null;
  aListCast: boolean | null;
  criticsVsFans: CriticsVsFans | null;
  oscarWinner: boolean | null;
  oscarNominee: boolean | null;
  directorProminence: number;
  onCultClassic: (v: boolean | null) => void;
  onAListCast: (v: boolean | null) => void;
  onCriticsVsFans: (v: CriticsVsFans | null) => void;
  onOscarWinner: (v: boolean | null) => void;
  onOscarNominee: (v: boolean | null) => void;
  onDirectorProminence: (v: number) => void;
}

function ToggleRow({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean | null;
  options: [string, string, string];
  onChange: (v: boolean | null) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 border-b border-brass/20 last:border-0">
      <div>
        <p className="font-medium text-brass-light text-sm">{label}</p>
        <p className="text-xs text-cream">{description}</p>
      </div>
      <div className="flex gap-2">
        {(['any', 'yes', 'no'] as const).map((opt, i) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt === 'any' ? null : opt === 'yes')}
            className={`px-3 py-1.5 rounded border-2 text-sm font-medium transition-all ${
              value === (opt === 'any' ? null : opt === 'yes')
                ? 'border-brass bg-brass/20 text-neon-gold'
                : 'border-brass/50 text-cream hover:border-brass'
            }`}
          >
            {options[i]}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Step4Pedigree({
  cultClassic,
  aListCast,
  criticsVsFans,
  oscarWinner,
  oscarNominee,
  directorProminence,
  onCultClassic,
  onAListCast,
  onCriticsVsFans,
  onOscarWinner,
  onOscarNominee,
  onDirectorProminence,
}: Step4PedigreeProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-8"
    >
      <div className="text-center">
        <h2 className="text-3xl font-display font-semibold text-neon-gold text-neon-glow mb-2">
          The Pedigree
        </h2>
        <p className="text-cream text-sm">Curator&apos;s picks</p>
      </div>

      <div className="space-y-6 max-w-2xl mx-auto max-h-[55vh] overflow-y-auto scroll-area-slate">
        <div>
          <div className="flex items-center gap-2 text-brass-light mb-3">
            <Star className="w-5 h-5" />
            <FilterIcon />
            <span className="font-medium text-sm">Cult Classic Status</span>
          </div>
          <ToggleRow
            label="Cult Signature"
            description="Underrated gems that found their audience"
            value={cultClassic}
            options={['Any', 'Yes', 'No']}
            onChange={onCultClassic}
          />
        </div>
        <div>
          <div className="flex items-center gap-2 text-brass-light mb-3">
            <Award className="w-5 h-5" />
            <FilterIcon />
            <span className="font-medium text-sm">A-List Cast</span>
          </div>
          <ToggleRow
            label="Big names only"
            description="Movies with recognizable stars"
            value={aListCast}
            options={['Any', 'Yes', 'No']}
            onChange={onAListCast}
          />
        </div>
        <div>
          <div className="flex items-center gap-2 text-brass-light mb-3">
            <Trophy className="w-5 h-5" />
            <FilterIcon />
            <span className="font-medium text-sm">Academy Awards</span>
          </div>
          <ToggleRow
            label="Best Picture winner"
            description="Oscar winner for Best Picture"
            value={oscarWinner}
            options={['Any', 'Yes', 'No']}
            onChange={onOscarWinner}
          />
          <ToggleRow
            label="Best Picture nominee"
            description="Nominated for Best Picture (winners count as nominees)"
            value={oscarNominee}
            options={['Any', 'Yes', 'No']}
            onChange={onOscarNominee}
          />
        </div>
        <div>
          <div className="flex items-center gap-2 text-brass-light mb-3">
            <Clapperboard className="w-5 h-5" />
            <RankIcon />
            <span className="font-medium text-sm">Director prominence</span>
          </div>
          <p className="text-xs text-cream mb-2">
            From any director (0) to household names only (100).
          </p>
          <div className="flex items-center gap-3">
            <span className="text-xs text-cream w-8">Any</span>
            <input
              type="range"
              min={0}
              max={100}
              value={directorProminence}
              onChange={(e) => onDirectorProminence(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-xs text-brass-light w-10 tabular-nums">{directorProminence}</span>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 text-brass-light mb-3">
            <ThumbsUp className="w-5 h-5" />
            <FilterIcon />
            <span className="font-medium text-sm">Critics vs. Fans</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['any', 'critics', 'fans', 'both'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onCriticsVsFans(opt === 'any' ? null : opt)}
                className={`px-3 py-1.5 rounded border-2 text-sm font-medium transition-all ${
                  criticsVsFans === (opt === 'any' ? null : opt)
                    ? 'border-brass bg-brass/20 text-neon-gold'
                    : 'border-brass/50 text-cream hover:border-brass'
                }`}
              >
                {opt === 'any' ? 'Any' : opt === 'both' ? 'Both' : opt === 'critics' ? 'Critics' : 'Fans'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
