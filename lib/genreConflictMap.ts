/**
 * When an Energy slider is pinned at **100**, exclude conflicting TMDB **genre** IDs via `without_genres`.
 * Universal “opposite” map — not Romance-only.
 *
 * @see TMDB genre list: https://developer.themoviedb.org/reference/genre-movie-list
 */
import type { FilterState } from './types';

/**
 * Per-axis exclusions when that slider is at **100** (automated “nuke” at API level).
 * IDs are TMDB `genre_ids`.
 */
export const GENRE_CONFLICT_MAP = {
  /** Fast: drop slow-burn / educational primary genres. */
  pacing: [99, 36] as const,
  /** Heavy cry: clear out action/adventure/comedy/thriller primaries that erase emotional weight. */
  cryMeter: [28, 12, 35, 53] as const,
  /** Laughs: clear out war/horror primaries that flatten comedy intent. */
  humor: [10752, 27] as const,
  /** Soft & safe romance. */
  romance: [10752, 27] as const,
  /** Tension: no silly / family-forward breaks. */
  suspense: [35, 10751] as const,
} as const;

export type EnergyAxisKey = keyof typeof GENRE_CONFLICT_MAP;

const AXES: EnergyAxisKey[] = ['pacing', 'cryMeter', 'humor', 'romance', 'suspense'];

/** Union of `GENRE_CONFLICT_MAP` rows for every axis currently at slider 100. */
export function getSlider100ConflictGenreIds(filters: FilterState): number[] {
  const out = new Set<number>();
  for (const ax of AXES) {
    if (filters[ax] !== 100) continue;
    for (const id of GENRE_CONFLICT_MAP[ax]) out.add(id);
  }
  return Array.from(out);
}
