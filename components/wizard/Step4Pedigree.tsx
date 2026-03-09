'use client';

import { motion } from 'framer-motion';
import { Star, Award, ThumbsUp, Trophy, Clapperboard } from 'lucide-react';
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
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-b border-brass/30 last:border-0">
      <div>
        <p className="font-medium text-brass-light">{label}</p>
        <p className="text-sm text-cherry-600">{description}</p>
      </div>
      <div className="flex gap-2">
        {(['any', 'yes', 'no'] as const).map((opt, i) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt === 'any' ? null : opt === 'yes')}
            className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
              value === (opt === 'any' ? null : opt === 'yes')
                ? 'border-brass bg-brass/20 text-neon-gold'
                : 'border-brass/50 text-cherry-600 hover:border-brass'
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
      className="space-y-6"
    >
      <div className="text-center">
        <h2 className="text-3xl font-display font-semibold text-neon-gold text-neon-glow mb-2">
          The Pedigree
        </h2>
        <p className="text-cherry-600 text-sm">Curator&apos;s picks</p>
      </div>

      {/* Opaque panel so sparkle background doesn't show through */}
      <div className="max-w-2xl mx-auto rounded-xl border-2 border-brass/50 overflow-hidden bg-cherry-950 shadow-lg">
        <div className="p-5 space-y-1 max-h-[55vh] overflow-y-auto scroll-area-slate">
          <div className="rounded-lg p-4 bg-cherry-900">
            <div className="flex items-center gap-2 text-brass-light mb-4">
              <Star className="w-5 h-5" />
              <span className="font-medium">Cult Classic Status</span>
            </div>
            <ToggleRow
              label="Cult Signature"
              description="Underrated gems that found their audience"
              value={cultClassic}
              options={['Any', 'Yes', 'No']}
              onChange={onCultClassic}
            />
          </div>
          <div className="rounded-lg p-4 bg-cherry-900">
            <div className="flex items-center gap-2 text-brass-light mb-4">
              <Award className="w-5 h-5" />
              <span className="font-medium">A-List Cast</span>
            </div>
            <ToggleRow
              label="Big names only"
              description="Movies with recognizable stars"
              value={aListCast}
              options={['Any', 'Yes', 'No']}
              onChange={onAListCast}
            />
          </div>
          <div className="rounded-lg p-4 bg-cherry-900">
            <div className="flex items-center gap-2 text-brass-light mb-4">
              <Trophy className="w-5 h-5" />
              <span className="font-medium">Academy Awards</span>
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
          <div className="rounded-lg p-4 bg-cherry-900">
            <div className="flex items-center gap-2 text-brass-light mb-4">
              <Clapperboard className="w-5 h-5" />
              <span className="font-medium">Director prominence</span>
            </div>
            <div className="py-3">
              <p className="text-sm text-cherry-600 mb-2">
                From any director (0) to household names only (100). TMDB: person popularity.
              </p>
              <div className="flex items-center gap-3">
                <span className="text-xs text-cherry-600 w-8">Any</span>
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
          </div>
          <div className="rounded-lg p-4 bg-cherry-900">
            <div className="flex items-center gap-2 text-brass-light mb-4">
              <ThumbsUp className="w-5 h-5" />
              <span className="font-medium">Critics vs. Fans</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3">
              <p className="text-sm text-cherry-600">Who loved it?</p>
              <div className="flex flex-wrap gap-2">
                {(['any', 'critics', 'fans', 'both'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onCriticsVsFans(opt === 'any' ? null : opt)}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                      criticsVsFans === (opt === 'any' ? null : opt)
                        ? 'border-brass bg-brass/20 text-neon-gold'
                        : 'border-brass/50 text-cherry-600 hover:border-brass'
                    }`}
                  >
                    {opt === 'any' ? 'Any' : opt === 'both' ? 'Both' : opt === 'critics' ? 'Critics' : 'Fans'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
