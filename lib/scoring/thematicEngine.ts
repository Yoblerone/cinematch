import type { FilterState, Movie } from '@/lib/types';
import { nearestFilterWeightStop, FILTER_WEIGHT_HIGH, FILTER_WEIGHT_LOW } from '@/lib/filterWeightSegments';
import { ENERGY_MANIFEST, type EnergyManifestAxis } from './energyManifest';

/** Manifest keyword hits — primary terms dominate; popularity is only a tie-breaker. */
const PRIMARY_VIBE_PTS = 25;
const SECONDARY_VIBE_PTS = 5;
const VIBE_ZERO_MATCH_PENALTY = 500;

const AXES: EnergyManifestAxis[] = [
  'narrative_pacing',
  'emotional_tone',
  'brain_power',
  'visual_style',
  'suspense_level',
  'world_style',
];

type ActiveTier = 'high' | 'low';

export interface DeclarativeThematicScore {
  /** Primary scoring output: manifest keyword points + tiny popularity anchor ± vibe floor. */
  finalVibeScore: number;
  /** primary×25 + secondary×5 (before popularity and floor). */
  baseVibeScore: number;
  primaryMatches: number;
  secondaryMatches: number;
  activeAxisMatches: number;
  profileAxisMatches: number;
  strictEligible: boolean;
  softEligible: boolean;
  /** Alias of `finalVibeScore` for legacy call sites. */
  finalScore: number;
  normalizedPopularity: number;
  passesHardVeto: boolean;
}

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countOccurrences(haystack: string, needleRaw: string): number {
  const needle = normalizeText(needleRaw);
  if (!needle) return 0;
  let count = 0;
  let idx = 0;
  while (idx < haystack.length) {
    const i = haystack.indexOf(needle, idx);
    if (i === -1) break;
    count++;
    idx = i + Math.max(needle.length, 1);
  }
  return count;
}

function movieHaystack(movie: Movie): string {
  const parts = [
    typeof movie.overview === 'string' ? movie.overview : '',
    typeof movie.tagline === 'string' ? movie.tagline : '',
    ...(movie.keywordNames ?? []),
  ];
  return normalizeText(parts.join(' \n '));
}

function activeTierForAxis(filters: FilterState, axis: EnergyManifestAxis): ActiveTier | null {
  const raw = filters[axis];
  if (raw == null) return null;
  const stop = nearestFilterWeightStop(raw);
  if (stop === FILTER_WEIGHT_HIGH) return 'high';
  if (stop === FILTER_WEIGHT_LOW) return 'low';
  return null;
}

function normalizedPopularity(movie: Movie): number {
  const pop = Math.max(0, movie.popularity ?? 0);
  return Math.atan(pop / 100) / (Math.PI / 2);
}

function hasActiveVibeAxis(filters: FilterState): boolean {
  for (const axis of AXES) {
    if (activeTierForAxis(filters, axis) !== null) return true;
  }
  return false;
}

/**
 * ENERGY_MANIFEST keyword tiers only (+25 / +5 per hit), popularity/100 tie-break,
 * −500 when any vibe axis is active but there are zero manifest keyword hits.
 */
export function scoreMovieDeclarative(movie: Movie, filters: FilterState): DeclarativeThematicScore {
  const haystack = movieHaystack(movie);
  let primaryMatches = 0;
  let secondaryMatches = 0;
  let activeAxisMatches = 0;

  for (const axis of AXES) {
    const tier = activeTierForAxis(filters, axis);
    if (tier == null) continue;

    const def = ENERGY_MANIFEST[axis][tier];
    let axisPrimary = 0;
    let axisSecondary = 0;

    for (const term of def.primary) {
      const c = countOccurrences(haystack, term);
      if (c <= 0) continue;
      axisPrimary += c;
      primaryMatches += c;
    }
    for (const term of def.secondary) {
      const c = countOccurrences(haystack, term);
      if (c <= 0) continue;
      axisSecondary += c;
      secondaryMatches += c;
    }

    if (axisPrimary > 0 || axisSecondary > 0) activeAxisMatches += 1;
  }

  const baseVibeScore = primaryMatches * PRIMARY_VIBE_PTS + secondaryMatches * SECONDARY_VIBE_PTS;
  const popAnchor = Math.max(0, movie.popularity ?? 0) / 100;

  const active = hasActiveVibeAxis(filters);
  const totalKwMatches = primaryMatches + secondaryMatches;
  const vibeFloor = active && totalKwMatches === 0 ? -VIBE_ZERO_MATCH_PENALTY : 0;

  const finalVibeScore = baseVibeScore + popAnchor + vibeFloor;
  const normPop = normalizedPopularity(movie);

  const strictEligible = !active || totalKwMatches > 0;
  const softEligible = totalKwMatches > 0;

  return {
    finalVibeScore,
    baseVibeScore,
    primaryMatches,
    secondaryMatches,
    activeAxisMatches,
    profileAxisMatches: 0,
    strictEligible,
    softEligible,
    finalScore: finalVibeScore,
    normalizedPopularity: normPop,
    passesHardVeto: true,
  };
}
