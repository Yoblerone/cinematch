'use client';

import { motion } from 'framer-motion';

const sliders = [
  { key: 'pacing' as const, label: 'Pacing', low: 'Slow Burn', high: 'Breakneck' },
  { key: 'cryMeter' as const, label: 'Cry Meter', low: 'Cool / Unmoved', high: 'Tissues' },
  { key: 'humor' as const, label: 'Humor', low: 'Dead Serious', high: 'Slapstick' },
  { key: 'romance' as const, label: 'Romance', low: 'None', high: 'Full-on' },
  { key: 'suspense' as const, label: 'Suspense', low: 'Calm', high: 'White-knuckle' },
] as const;

interface Step2EnergyProps {
  pacing: number;
  intensity: number;
  cryMeter: number;
  humor: number;
  romance: number;
  suspense: number;
  onChange: (key: 'pacing' | 'intensity' | 'cryMeter' | 'humor' | 'romance' | 'suspense', value: number) => void;
}

export default function Step2Energy({
  pacing,
  intensity,
  cryMeter,
  humor,
  romance,
  suspense,
  onChange,
}: Step2EnergyProps) {
  const values = { pacing, intensity, cryMeter, humor, romance, suspense };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-8"
    >
      <div className="text-center">
        <h2 className="text-3xl font-display font-semibold text-neon-gold text-neon-glow mb-2">
          The Energy & Emotion
        </h2>
        <p className="text-cream text-sm">Set the vibe</p>
      </div>
      <div className="scroll-area-slate space-y-6 max-w-xl mx-auto max-h-[55vh] overflow-y-auto">
        {sliders.map((slider) => {
          const { key, label, low, high } = slider;
          return (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-brass-light">{label}</span>
                <span className="text-cream text-sm">{values[key]}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={values[key]}
                onChange={(e) => onChange(key, Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-cream">
                <span>{low}</span>
                <span>{high}</span>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
