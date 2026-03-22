'use client';

interface SteppedRangeTrackProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  /** Same classes as Energy sliders — `globals.css` `input[type="range"]` styles apply. */
  className?: string;
}

/** Shared 0–100 range, step 10, matches `EnergySliderRow` track layout (− / + decorative). */
export default function SteppedRangeTrack({
  value,
  onChange,
  disabled = false,
  className = '',
}: SteppedRangeTrackProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="w-4 shrink-0 text-center text-lg font-semibold leading-none text-neon-gold" aria-hidden>
        -
      </span>
      <input
        type="range"
        min={0}
        max={100}
        step={10}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const raw = Number(e.target.value);
          const snapped = Math.round(raw / 10) * 10;
          onChange(Math.max(0, Math.min(100, snapped)));
        }}
        className={`min-w-0 flex-1 w-full ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      />
      <span className="w-4 shrink-0 text-center text-lg font-semibold leading-none text-neon-gold" aria-hidden>
        +
      </span>
    </div>
  );
}
