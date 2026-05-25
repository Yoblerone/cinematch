import type { Runtime, RuntimeBand } from '@/lib/types';
import { MAX_RUNTIMES } from '@/lib/types';

export type { RuntimeBand };
export { MAX_RUNTIMES };

export const RUNTIME_BANDS: RuntimeBand[] = ['short', 'medium', 'long'];

export const RUNTIME_RANGES: Record<RuntimeBand, { gte: number; lte: number }> = {
  short: { gte: 0, lte: 89 },
  medium: { gte: 90, lte: 150 },
  long: { gte: 151, lte: 400 },
};

const RUNTIME_LABELS: Record<RuntimeBand, string> = {
  short: 'Short (<90 min)',
  medium: 'Medium (90–150 min)',
  long: 'Long (2.5 hr+)',
};

export function runtimeBandLabel(band: RuntimeBand): string {
  return RUNTIME_LABELS[band];
}

/** Accept legacy single string or array from API/session. */
export function normalizeRuntimeSelection(raw: unknown): RuntimeBand[] {
  if (Array.isArray(raw)) {
    const out: RuntimeBand[] = [];
    for (const x of raw) {
      if (x === 'short' || x === 'medium' || x === 'long') {
        if (!out.includes(x) && out.length < MAX_RUNTIMES) out.push(x);
      }
    }
    return out;
  }
  if (raw === 'short' || raw === 'medium' || raw === 'long') return [raw];
  return [];
}

function bandMatchesMinutes(minutes: number, band: RuntimeBand): boolean {
  if (band === 'short') return minutes < 90;
  if (band === 'medium') return minutes >= 90 && minutes <= 150;
  return minutes > 150;
}

/** OR across selected runtime bands (empty = any). Unknown minutes do not fail. */
export function movieMatchesRuntime(runtimeMinutes: number, bands: RuntimeBand[]): boolean {
  if (bands.length === 0) return true;
  if (runtimeMinutes <= 0) return true;
  return bands.some((band) => bandMatchesMinutes(runtimeMinutes, band));
}

export type RuntimeSqlBounds =
  | { kind: 'none' }
  | { kind: 'range'; gte: number; lte: number }
  | { kind: 'or'; filter: string };

/**
 * SQL bounds for Supabase/TMDB: contiguous pairs merge; short+long needs OR.
 */
export function resolveRuntimeSqlBounds(bands: RuntimeBand[]): RuntimeSqlBounds {
  if (bands.length === 0) return { kind: 'none' };
  if (bands.length === 1) {
    const r = RUNTIME_RANGES[bands[0]!];
    return { kind: 'range', gte: r.gte, lte: r.lte };
  }
  const set = new Set(bands);
  if (set.has('short') && set.has('medium') && !set.has('long')) {
    return { kind: 'range', gte: 0, lte: 150 };
  }
  if (set.has('medium') && set.has('long') && !set.has('short')) {
    return { kind: 'range', gte: 90, lte: 400 };
  }
  if (set.has('short') && set.has('long') && !set.has('medium')) {
    return { kind: 'or', filter: 'runtime_minutes.lte.89,runtime_minutes.gte.151' };
  }
  return { kind: 'range', gte: 0, lte: 400 };
}

export function formatRuntimeSelection(bands: RuntimeBand[]): string {
  if (bands.length === 0) return '';
  return bands.map(runtimeBandLabel).join(' + ');
}
