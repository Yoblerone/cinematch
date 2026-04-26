'use client';

import { motion } from 'framer-motion';
import { Award, ThumbsUp, Trophy } from 'lucide-react';
import StepResetButton from './StepResetButton';
import type { CriticsVsFans } from '@/lib/types';

export type OscarFilterValue = 'nominee' | 'winner' | 'both' | null;

interface Step4PedigreeProps {
  aListCast: 'low' | 'high' | null;
  directorProminence: 'low' | 'high' | null;
  oscarFilter: OscarFilterValue;
  criticsVsFans: CriticsVsFans | null;
  onAListCast: (v: 'low' | 'high' | null) => void;
  onDirectorProminence: (v: 'low' | 'high' | null) => void;
  onOscarFilter: (v: OscarFilterValue) => void;
  onCriticsVsFans: (v: CriticsVsFans | null) => void;
  onResetStep?: () => void;
}

export default function Step4Pedigree({
  aListCast,
  directorProminence,
  oscarFilter,
  criticsVsFans,
  onAListCast,
  onDirectorProminence,
  onOscarFilter,
  onCriticsVsFans,
  onResetStep,
}: Step4PedigreeProps) {
  const oscarOn = oscarFilter != null;
  const criticsOn = criticsVsFans != null;
  const pedigreeChipBase =
    'flex-1 min-w-0 basis-0 min-h-[44px] rounded-sm border-2 text-sm font-medium transition-all duration-300 touch-manipulation px-3 py-2 flex items-center justify-center text-center';
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
        {onResetStep && <StepResetButton onReset={onResetStep} />}
      </div>

      <div className="mx-auto w-full max-w-xl space-y-6">
        <div className={`space-y-2 transition-all duration-200 ${aListCast == null ? 'stage-light-off' : 'stage-light-on'}`}>
          <div className="text-center">
            <div className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
              <Award className="h-5 w-5 shrink-0" aria-hidden />
              <button
                type="button"
                role="switch"
                aria-checked={aListCast != null}
                aria-label="Toggle Star Power"
                onClick={() => onAListCast(aListCast == null ? 'low' : null)}
                className={`filament-switch ${aListCast != null ? 'filament-switch--on' : 'filament-switch--off'}`}
              />
              <button
                type="button"
                onClick={() => onAListCast(aListCast == null ? 'low' : null)}
                className={`bg-transparent p-0 text-sm font-medium ${aListCast != null ? 'text-[#FFD700] filament-label-on' : 'text-brass-light'}`}
                aria-label="Toggle Star Power"
              >
                Star Power
              </button>
            </div>
          </div>
          <div className={aListCast == null ? 'pointer-events-none stage-control-off' : ''}>
            <div className="flex gap-2" role="radiogroup" aria-label="Star power level">
              {(['low', 'high'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  role="radio"
                  aria-checked={aListCast === opt}
                  onClick={() => onAListCast(opt)}
                  className={`${pedigreeChipBase} ${
                    aListCast === opt
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
        <div className={`space-y-2 transition-all duration-200 ${directorProminence == null ? 'stage-light-off' : 'stage-light-on'}`}>
          <div className="text-center">
            <div className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
              <Trophy className="h-5 w-5 shrink-0" aria-hidden />
              <button
                type="button"
                role="switch"
                aria-checked={directorProminence != null}
                aria-label="Toggle Director prominence"
                onClick={() => onDirectorProminence(directorProminence == null ? 'low' : null)}
                className={`filament-switch ${directorProminence != null ? 'filament-switch--on' : 'filament-switch--off'}`}
              />
              <button
                type="button"
                onClick={() => onDirectorProminence(directorProminence == null ? 'low' : null)}
                className={`bg-transparent p-0 text-sm font-medium ${directorProminence != null ? 'text-[#FFD700] filament-label-on' : 'text-brass-light'}`}
                aria-label="Toggle Director prominence"
              >
                Director prominence
              </button>
            </div>
          </div>
          <div className={directorProminence == null ? 'pointer-events-none stage-control-off' : ''}>
            <div className="flex gap-2" role="radiogroup" aria-label="Director prominence level">
              {(['low', 'high'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  role="radio"
                  aria-checked={directorProminence === opt}
                  onClick={() => onDirectorProminence(opt)}
                  className={`${pedigreeChipBase} ${
                    directorProminence === opt
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

        <div className={`space-y-2 transition-all duration-200 ${oscarOn ? 'stage-light-on' : 'stage-light-off'}`}>
          <div className="flex items-center justify-center gap-2">
            <Trophy className="w-5 h-5" />
            <button
              type="button"
              role="switch"
              aria-checked={oscarOn}
              aria-label="Toggle Best Picture filter"
              onClick={() => onOscarFilter(oscarOn ? null : 'nominee')}
              className={`filament-switch ${oscarOn ? 'filament-switch--on' : 'filament-switch--off'}`}
            />
            <button
              type="button"
              onClick={() => onOscarFilter(oscarOn ? null : 'nominee')}
              className={`bg-transparent p-0 font-medium text-sm ${oscarOn ? 'text-[#FFD700] filament-label-on' : 'text-brass-light'}`}
              aria-label="Toggle Best Picture filter"
            >
              Best Picture
            </button>
          </div>
          <div className={oscarOn ? '' : 'pointer-events-none stage-control-off'}>
            <div className="flex gap-2" role="radiogroup" aria-label="Best Picture level">
              {(['nominee', 'winner', 'both'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  role="radio"
                  aria-checked={oscarFilter === opt}
                  onClick={() => onOscarFilter(opt)}
                  className={`${pedigreeChipBase} ${
                    oscarFilter === opt
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

        <div className={`space-y-2 transition-all duration-200 ${criticsOn ? 'stage-light-on' : 'stage-light-off'}`}>
          <div className="flex items-center gap-2 justify-center">
            <ThumbsUp className="w-5 h-5" />
            <button
              type="button"
              role="switch"
              aria-checked={criticsOn}
              aria-label="Toggle Critics vs. Fans filter"
              onClick={() => onCriticsVsFans(criticsOn ? null : 'critics')}
              className={`filament-switch ${criticsOn ? 'filament-switch--on' : 'filament-switch--off'}`}
            />
            <button
              type="button"
              onClick={() => onCriticsVsFans(criticsOn ? null : 'critics')}
              className={`bg-transparent p-0 font-medium text-sm ${criticsOn ? 'text-[#FFD700] filament-label-on' : 'text-brass-light'}`}
              aria-label="Toggle Critics vs. Fans filter"
            >
              Critics vs. Fans
            </button>
          </div>
          <div className={criticsOn ? '' : 'pointer-events-none stage-control-off'}>
            <div className="flex gap-2" role="radiogroup" aria-label="Critics versus Fans level">
              {(['critics', 'fans', 'both'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  role="radio"
                  aria-checked={criticsVsFans === opt}
                  onClick={() => onCriticsVsFans(opt)}
                  className={`${pedigreeChipBase} ${
                    criticsVsFans === opt
                      ? 'border-brass bg-brass/15 text-neon-gold shadow-[0_0_20px_rgba(184,134,11,0.4)]'
                      : 'border-brass/50 bg-transparent text-cream hover:border-brass hover:text-brass-light'
                  }`}
                >
                  {opt === 'both' ? 'Top Rated' : opt === 'critics' ? 'Critics' : 'Fans'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
