'use client';

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
      <div className="flex items-center gap-2">
        <span className="w-4 shrink-0 text-center text-lg font-semibold leading-none text-neon-gold" aria-hidden>
          -
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={10}
          value={value}
          onChange={(e) => {
            const raw = Number(e.target.value);
            const snapped = Math.round(raw / 10) * 10;
            onChange(Math.max(0, Math.min(100, snapped)));
          }}
          className="min-w-0 flex-1 w-full"
        />
        <span className="w-4 shrink-0 text-center text-lg font-semibold leading-none text-neon-gold" aria-hidden>
          +
        </span>
      </div>
    </div>
  );
}
