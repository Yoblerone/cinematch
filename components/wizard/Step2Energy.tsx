'use client';

import { motion } from 'framer-motion';
import StepResetButton from './StepResetButton';
import EnergySliderRow from './EnergySliderRow';

const sliders = [
  { key: 'pacing' as const, label: 'Pacing' },
  { key: 'cryMeter' as const, label: 'Cry Meter' },
  { key: 'humor' as const, label: 'Humor' },
  { key: 'romance' as const, label: 'Romance' },
  { key: 'suspense' as const, label: 'Suspense' },
] as const;

interface Step2EnergyProps {
  pacing: number;
  intensity: number;
  cryMeter: number;
  humor: number;
  romance: number;
  suspense: number;
  onChange: (key: 'pacing' | 'intensity' | 'cryMeter' | 'humor' | 'romance' | 'suspense', value: number) => void;
  onResetStep?: () => void;
}

export default function Step2Energy({
  pacing,
  intensity,
  cryMeter,
  humor,
  romance,
  suspense,
  onChange,
  onResetStep,
}: Step2EnergyProps) {
  const values = { pacing, intensity, cryMeter, humor, romance, suspense };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="mx-auto flex w-full max-w-xl flex-col items-center pl-5 pr-3 sm:pl-8 sm:pr-4"
    >
      {/* One column: title, subtitle, reset, and sliders share the same center line */}
      <div className="flex w-full flex-col items-center text-center">
        <h2 className="mb-2 text-3xl font-display font-semibold text-neon-gold text-neon-glow">
          The Energy & Emotion
        </h2>
        <p className="text-sm text-cream">Set the vibe</p>
        {onResetStep && <StepResetButton onReset={onResetStep} />}
      </div>
      <div className="scroll-area-slate mt-8 w-full space-y-6 max-h-[55vh] overflow-y-auto">
        {sliders.map((slider) => {
          const { key, label } = slider;
          return (
            <EnergySliderRow
              key={key}
              label={label}
              value={values[key]}
              onChange={(v) => onChange(key, v)}
            />
          );
        })}
      </div>
    </motion.div>
  );
}
