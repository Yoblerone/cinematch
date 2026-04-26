'use client';

import SegmentedControl, { type SegmentedDensity } from './SegmentedControl';

interface EnergySliderRowProps {
  label: string;
  value: number | null;
  active: boolean;
  onToggleActive: (active: boolean) => void;
  onChange: (value: number) => void;
  optionLabels?: { low: string; mid?: string; high: string };
  /** Wizard: full words; slate: compact on narrow viewports. */
  density?: SegmentedDensity;
  variant?: 'default' | 'pacingBinary';
}

/** Energy & emotion: discrete Low / Medium / High (maps to 20 / 50 / 90 on the 0–100 filter scale). */
export default function EnergySliderRow({
  label,
  value,
  active,
  onToggleActive,
  onChange,
  optionLabels,
  density = 'full',
  variant = 'default',
}: EnergySliderRowProps) {
  const resolved = value ?? 20;
  return (
    <div
      className={`w-full space-y-2 transition-all duration-200 ${
        active ? 'stage-light-on' : 'stage-light-off'
      }`}
    >
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={active}
          aria-label={`${label} toggle`}
          onClick={() => onToggleActive(!active)}
          className={`filament-switch ${active ? 'filament-switch--on' : 'filament-switch--off'}`}
        />
        <button
          type="button"
          onClick={() => onToggleActive(!active)}
          className={`bg-transparent p-0 font-medium ${active ? 'filament-label-on text-[#FFD700]' : 'text-brass-light'}`}
          aria-label={`Toggle ${label}`}
        >
          {label}
        </button>
      </div>
      <div className={active ? '' : 'pointer-events-none stage-control-off'}>
        <SegmentedControl
          value={resolved}
          onChange={onChange}
          customLabels={optionLabels}
          density={density}
          disabled={!active}
          ariaLabel={`${label} level`}
          mode={variant === 'pacingBinary' ? 'pacingBinary' : 'default'}
        />
      </div>
    </div>
  );
}
