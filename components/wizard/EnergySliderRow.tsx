'use client';

import SteppedRangeTrack from './SteppedRangeTrack';

interface EnergySliderRowProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

/** Energy & Emotion slider: centered “Label value”, gold − / + at ends (decorative). */
export default function EnergySliderRow({ label, value, onChange }: EnergySliderRowProps) {
  return (
    <div className="w-full space-y-2">
      <div className="text-center">
        <span className="font-medium text-brass-light">
          {label}{' '}
          <span className="tabular-nums text-cream">{value}</span>
        </span>
      </div>
      <SteppedRangeTrack value={value} onChange={onChange} />
    </div>
  );
}
