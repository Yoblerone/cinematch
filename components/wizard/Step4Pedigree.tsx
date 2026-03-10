'use client';

import { motion } from 'framer-motion';
import { Award, ThumbsUp, Trophy } from 'lucide-react';
import type { CriticsVsFans } from '@/lib/types';

export type OscarFilterValue = 'any' | 'nominee' | 'winner';

interface Step4PedigreeProps {
  aListCastAny: boolean;
  aListCast: number;
  directorProminenceAny: boolean;
  directorProminence: number;
  oscarFilter: OscarFilterValue;
  criticsVsFans: CriticsVsFans | null;
  onAListCastAny: (v: boolean) => void;
  onAListCast: (v: number) => void;
  onDirectorProminenceAny: (v: boolean) => void;
  onDirectorProminence: (v: number) => void;
  onOscarFilter: (v: OscarFilterValue) => void;
  onCriticsVsFans: (v: CriticsVsFans | null) => void;
}

export default function Step4Pedigree({
  aListCastAny,
  aListCast,
  directorProminenceAny,
  directorProminence,
  oscarFilter,
  criticsVsFans,
  onAListCastAny,
  onAListCast,
  onDirectorProminenceAny,
  onDirectorProminence,
  onOscarFilter,
  onCriticsVsFans,
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

      <div className="space-y-6 max-w-xl mx-auto max-h-[55vh] overflow-y-auto scroll-area-slate">
        {/* Sliders stacked vertically, matching Step 2 width and track styling */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-brass-light">
              <Award className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium text-sm">A-List Cast (Star Power)</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aListCastAny}
                  onChange={(e) => onAListCastAny(e.target.checked)}
                  className="rounded border-brass/50 text-brass bg-cherry-900"
                />
                <span className="text-xs text-cream whitespace-nowrap">Any</span>
              </label>
            </div>
            <span className="text-cream text-sm tabular-nums">{aListCastAny ? '—' : aListCast}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={aListCast}
            onChange={(e) => onAListCast(Number(e.target.value))}
            disabled={aListCastAny}
            className={`w-full ${aListCastAny ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
          <div className="flex justify-between text-xs text-cream">
            <span>Indie ensembles</span>
            <span>Star power</span>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-brass-light">
              <Trophy className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium text-sm">Director prominence</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={directorProminenceAny}
                  onChange={(e) => onDirectorProminenceAny(e.target.checked)}
                  className="rounded border-brass/50 text-brass bg-cherry-900"
                />
                <span className="text-xs text-cream whitespace-nowrap">Any</span>
              </label>
            </div>
            <span className="text-cream text-sm tabular-nums">{directorProminenceAny ? '—' : directorProminence}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={directorProminence}
            onChange={(e) => onDirectorProminence(Number(e.target.value))}
            disabled={directorProminenceAny}
            className={`w-full ${directorProminenceAny ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
          <div className="flex justify-between text-xs text-cream">
            <span>Indie</span>
            <span>Household names</span>
          </div>
        </div>

        {/* Oscar: [Any] [Nominee] [Winner] */}
        <div>
          <div className="flex items-center gap-2 text-brass-light mb-3">
            <Trophy className="w-5 h-5" />
            <span className="font-medium text-sm">Academy Awards</span>
          </div>
          <p className="text-xs text-cream mb-2">Best Picture only. Pick one: Nominee (incl. winners) or Winner (Best Picture winners first).</p>
          <div className="flex gap-2" role="radiogroup" aria-label="Academy Award Best Picture filter">
            {(['any', 'nominee', 'winner'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                role="radio"
                aria-checked={oscarFilter === opt}
                onClick={() => onOscarFilter(opt)}
                className={`px-3 py-1.5 rounded-sm border-2 text-sm font-medium transition-all duration-300 ${
                  oscarFilter === opt ? 'border-brass bg-brass/15 text-neon-gold shadow-[0_0_20px_rgba(184,134,11,0.4)]' : 'border-brass/50 text-cream hover:border-brass hover:text-brass-light'
                }`}
              >
                {opt === 'any' ? 'Any' : opt === 'nominee' ? 'Nominee' : 'Winner'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 text-brass-light mb-3">
            <ThumbsUp className="w-5 h-5" />
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
