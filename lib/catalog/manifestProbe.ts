import type { FilterState } from '@/lib/types';
import { nearestFilterWeightStop, FILTER_WEIGHT_HIGH, FILTER_WEIGHT_LOW } from '@/lib/filterWeightSegments';
import { ENERGY_MANIFEST, type EnergyManifestAxis } from '@/lib/scoring/energyManifest';

const ENERGY_AXES: EnergyManifestAxis[] = [
  'narrative_pacing',
  'emotional_tone',
  'brain_power',
  'visual_style',
  'suspense_level',
  'world_style',
];

/** Stable offset into popularity-sorted catalog slices so pools shift with filter changes. */
export function catalogPoolOffset(filters: FilterState): number {
  const parts = [
    filters.genre.join('|'),
    filters.decade.join('|'),
    filters.runtime ?? '',
    filters.crowd ?? '',
    filters.narrative_pacing ?? '',
    filters.emotional_tone ?? '',
    filters.brain_power ?? '',
    filters.visual_style ?? '',
    filters.suspense_level ?? '',
    filters.world_style ?? '',
    filters.originalLanguage ?? '',
  ];
  let h = 2166136261;
  for (const part of parts) {
    const s = String(part);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return (h >>> 0) % 400;
}

/** TMDB keyword ids for manifest tiers matching active Low/High energy sliders. */
export function activeManifestKeywordIds(filters: FilterState, cap = 48): number[] {
  const ids = new Set<number>();
  for (const axis of ENERGY_AXES) {
    const raw = filters[axis];
    if (raw == null) continue;
    const stop = nearestFilterWeightStop(raw);
    const tier =
      stop === FILTER_WEIGHT_HIGH ? 'high' : stop === FILTER_WEIGHT_LOW ? 'low' : null;
    if (!tier) continue;
    const def = ENERGY_MANIFEST[axis][tier];
    for (const id of def.tmdb_keyword_ids) {
      if (Number.isFinite(id) && id > 0) ids.add(id);
    }
  }
  return Array.from(ids).slice(0, cap);
}

export function catalogHasManifestProbe(filters: FilterState): boolean {
  return activeManifestKeywordIds(filters, 1).length > 0;
}
