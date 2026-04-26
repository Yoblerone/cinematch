'use client';

import { motion } from 'framer-motion';
import StepResetButton from './StepResetButton';
import EnergySliderRow from './EnergySliderRow';

const sliders = [
  {
    key: 'narrative_pacing' as const,
    label: 'Narrative Pacing',
    optionLabels: { low: 'Slow', high: 'Fast' },
  },
  {
    key: 'emotional_tone' as const,
    label: 'Emotional Tone',
    optionLabels: { low: 'Light', high: 'Heavy' },
  },
  {
    key: 'brain_power' as const,
    label: 'Brain Power',
    optionLabels: { low: 'Low', high: 'High' },
  },
  {
    key: 'visual_style' as const,
    label: 'Visual Style',
    optionLabels: { low: 'Intimate', mid: 'Cinematic', high: 'Epic' },
  },
  {
    key: 'suspense_level' as const,
    label: 'Suspense Level',
    optionLabels: { low: 'Relaxed', high: 'Tense' },
  },
  {
    key: 'world_style' as const,
    label: 'World Style',
    optionLabels: { low: 'Grounded', mid: 'Stylized', high: 'Surreal' },
  },
] as const;

interface Step2EnergyProps {
  narrative_pacing: number | null;
  emotional_tone: number | null;
  brain_power: number | null;
  visual_style: number | null;
  suspense_level: number | null;
  world_style: number | null;
  onChange: (
    key:
      | 'narrative_pacing'
      | 'emotional_tone'
      | 'brain_power'
      | 'visual_style'
      | 'suspense_level'
      | 'world_style',
    value: number
  ) => void;
  onToggle: (
    key:
      | 'narrative_pacing'
      | 'emotional_tone'
      | 'brain_power'
      | 'visual_style'
      | 'suspense_level'
      | 'world_style',
    active: boolean
  ) => void;
  onResetStep?: () => void;
}

export default function Step2Energy({
  narrative_pacing,
  emotional_tone,
  brain_power,
  visual_style,
  suspense_level,
  world_style,
  onChange,
  onToggle,
  onResetStep,
}: Step2EnergyProps) {
  const values = {
    narrative_pacing,
    emotional_tone,
    brain_power,
    visual_style,
    suspense_level,
    world_style,
  };

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
        {onResetStep && <StepResetButton onReset={onResetStep} />}
      </div>
      <div className="mt-8 w-full space-y-6">
        {sliders.map((slider) => {
          const { key, label, optionLabels } = slider;
          return (
            <EnergySliderRow
              key={key}
              label={label}
              optionLabels={optionLabels}
              value={values[key]}
              active={values[key] != null}
              onToggleActive={(active) => onToggle(key, active)}
              onChange={(v) => onChange(key, v)}
              variant={
                key === 'narrative_pacing' ||
                key === 'emotional_tone' ||
                key === 'brain_power' ||
                key === 'suspense_level'
                  ? 'pacingBinary'
                  : 'default'
              }
            />
          );
        })}
      </div>
    </motion.div>
  );
}
