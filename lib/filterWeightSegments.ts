/** Normalized intent (0–1). Results UI still stores the 0–100 equivalents below. */
export const FILTER_INTENT_LOW = 0.2;
export const FILTER_INTENT_MED = 0.5;
export const FILTER_INTENT_HIGH = 0.9;

/** Discrete weights on the existing 0–100 `FilterState` scale (0.2 / 0.5 / 0.9 × 100). */
export const FILTER_WEIGHT_LOW = Math.round(FILTER_INTENT_LOW * 100);
export const FILTER_WEIGHT_MED = Math.round(FILTER_INTENT_MED * 100);
export const FILTER_WEIGHT_HIGH = Math.round(FILTER_INTENT_HIGH * 100);

export const FILTER_WEIGHT_STOPS = [FILTER_WEIGHT_LOW, FILTER_WEIGHT_MED, FILTER_WEIGHT_HIGH] as const;

export type FilterWeightStop = (typeof FILTER_WEIGHT_STOPS)[number];

export function nearestFilterWeightStop(value: number): FilterWeightStop {
  if (!Number.isFinite(value)) return FILTER_WEIGHT_MED;
  let best: FilterWeightStop = FILTER_WEIGHT_MED;
  let bestDist = Infinity;
  for (const w of FILTER_WEIGHT_STOPS) {
    const d = Math.abs(value - w);
    if (d < bestDist) {
      bestDist = d;
      best = w;
    }
  }
  return best;
}

export function filterWeightTierLabel(value: number): 'Low' | 'Medium' | 'High' {
  const w = nearestFilterWeightStop(value);
  if (w === FILTER_WEIGHT_LOW) return 'Low';
  if (w === FILTER_WEIGHT_HIGH) return 'High';
  return 'Medium';
}
