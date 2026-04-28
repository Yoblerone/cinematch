'use client';

import { useCallback, useRef } from 'react';
import {
  FILTER_WEIGHT_HIGH,
  FILTER_WEIGHT_LOW,
  FILTER_WEIGHT_MED,
  nearestFilterWeightStop,
  type FilterWeightStop,
} from '@/lib/filterWeightSegments';

export type SegmentedDensity = 'full' | 'responsive';

interface SegmentedControlProps {
  value: number;
  onChange: (value: number) => void;
  density?: SegmentedDensity;
  disabled?: boolean;
  mode?: 'default' | 'pacingBinary';
  customLabels?: { low: string; mid?: string; high: string };
  /** Accessible name for the radiogroup (e.g. "Pacing intensity"). */
  ariaLabel: string;
  className?: string;
}

const SEGMENT_META: { weight: FilterWeightStop; full: string; intentTitle: string }[] = [
  { weight: FILTER_WEIGHT_LOW, full: 'Low', intentTitle: 'Subtle influence' },
  { weight: FILTER_WEIGHT_MED, full: 'Medium', intentTitle: 'Balanced' },
  { weight: FILTER_WEIGHT_HIGH, full: 'High', intentTitle: 'Strong driver' },
];

/** Matches The Basics chips (e.g. decade / runtime in `DirectorsConsole`). */
const chipBase =
  'flex-1 min-w-0 basis-0 min-h-[44px] rounded-sm border-2 font-medium transition-all duration-300 touch-manipulation outline-none focus-visible:ring-2 focus-visible:ring-neon-gold focus-visible:ring-offset-2 focus-visible:ring-offset-cherry-950 py-2 flex items-center justify-center text-center';

/** Wizard slate / narrow viewports: keep full words; shrink type instead of initials (see `density`). */
function chipSizingClasses(density: SegmentedDensity): string {
  return density === 'responsive'
    ? 'px-1.5 text-[11px] leading-snug sm:px-3 sm:text-sm sm:leading-normal'
    : 'px-3 text-sm';
}

export default function SegmentedControl({
  value,
  onChange,
  density = 'full',
  disabled = false,
  mode = 'default',
  customLabels,
  ariaLabel,
  className = '',
}: SegmentedControlProps) {
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const active = nearestFilterWeightStop(value);
  const segments =
    mode === 'pacingBinary'
      ? [SEGMENT_META[0], SEGMENT_META[2]].filter((s): s is (typeof SEGMENT_META)[number] => s != null)
      : SEGMENT_META;
  const activeIndex = segments.findIndex((s) => s.weight === active);
  const fallbackIndex = mode === 'pacingBinary' ? 0 : 1;
  const safeIndex = activeIndex < 0 ? fallbackIndex : activeIndex;
  const maxIndex = segments.length - 1;

  const focusIndex = (i: number) => {
    requestAnimationFrame(() => btnRefs.current[i]?.focus());
  };

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.min(maxIndex, safeIndex + 1);
        onChange(segments[next].weight);
        focusIndex(next);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const next = Math.max(0, safeIndex - 1);
        onChange(segments[next].weight);
        focusIndex(next);
      } else if (e.key === 'Home') {
        e.preventDefault();
        onChange(segments[0].weight);
        focusIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        onChange(segments[maxIndex].weight);
        focusIndex(maxIndex);
      }
    },
    [disabled, maxIndex, onChange, safeIndex, segments]
  );

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={`flex gap-2 ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`}
    >
      {segments.map(({ weight, full, intentTitle }, i) => {
        const selected = active === weight;
        const displayFull =
          mode === 'pacingBinary'
            ? weight === FILTER_WEIGHT_LOW
              ? customLabels?.low ?? 'Slow'
              : customLabels?.high ?? 'Fast'
            : weight === FILTER_WEIGHT_LOW
              ? customLabels?.low ?? full
              : weight === FILTER_WEIGHT_MED
                ? customLabels?.mid ?? full
                : customLabels?.high ?? full;
        const displayTitle =
          mode === 'pacingBinary' ? `${displayFull} pacing preference` : intentTitle;
        return (
          <button
            key={weight}
            ref={(el) => {
              btnRefs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            title={displayTitle}
            onClick={() => onChange(weight)}
            className={`${chipBase} ${chipSizingClasses(density)} ${
              selected
                ? 'border-brass bg-brass/15 text-neon-gold shadow-[0_0_20px_rgba(184,134,11,0.4)]'
                : 'border-brass/50 bg-transparent text-cream hover:border-brass hover:text-brass-light'
            } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {displayFull}
          </button>
        );
      })}
    </div>
  );
}
