/**
 * Smart Harvest: maps Energy sliders → TMDB Discover **genre** augmentation only.
 * Vibe **keywords** are not sent to Discover — they are used in-app for ranking (`vibeScore` / `filterMovies`).
 * @see `lib/genreConflictMap.ts` for slider-100 `without_genres` exclusions.
 */
import type { FilterState } from './types';
import { GENRE_NAME_TO_ID, type SmartHarvestQuerySlice } from './tmdb';
import { getSlider100ConflictGenreIds } from './genreConflictMap';

const SLIDER_HIGH = 80;
const SLIDER_LOW = 20;

const ENERGY_AXES = ['pacing', 'cryMeter', 'humor', 'romance', 'suspense'] as const;

export function buildSmartHarvestAugmentation(filters: FilterState): SmartHarvestQuerySlice {
  const withoutGenres = new Set<number>();
  /** Step threshold: snapped 0–20 triggers low-end exclusions. */
  if (filters.romance <= SLIDER_LOW) withoutGenres.add(GENRE_NAME_TO_ID.Romance);
  if (filters.humor <= SLIDER_LOW) withoutGenres.add(GENRE_NAME_TO_ID.Comedy);
  for (const id of getSlider100ConflictGenreIds(filters)) withoutGenres.add(id);
  /**
   * User Wins rule: never veto genres explicitly selected in the UI.
   * Example: Drama selected + Humor=100 should keep Drama in the fetch pool.
   */
  const selectedGenreIds = new Set<number>(
    filters.genre.map((g) => GENRE_NAME_TO_ID[g]).filter((id): id is number => id != null)
  );
  for (const id of Array.from(selectedGenreIds)) withoutGenres.delete(id);

  let withGenresOr: string | undefined;
  if (filters.genre.length === 0) {
    const or = new Set<number>();
    /** Sliders at 100 use primary anchors only (`withGenresSlider100Pipe`) — avoid duplicating / over-constraining. */
    if (filters.romance > SLIDER_HIGH && filters.romance < 100) or.add(GENRE_NAME_TO_ID.Romance);
    if (filters.humor > SLIDER_HIGH && filters.humor < 100) or.add(GENRE_NAME_TO_ID.Comedy);
    if (filters.pacing > SLIDER_HIGH && filters.pacing < 100) {
      or.add(GENRE_NAME_TO_ID.Action);
      or.add(GENRE_NAME_TO_ID.Thriller);
    }
    if (filters.cryMeter > SLIDER_HIGH && filters.cryMeter < 100) or.add(GENRE_NAME_TO_ID.Drama);
    if (filters.suspense > SLIDER_HIGH && filters.suspense < 100) {
      or.add(GENRE_NAME_TO_ID.Thriller);
      or.add(GENRE_NAME_TO_ID.Mystery);
      or.add(GENRE_NAME_TO_ID.Horror);
    }
    if (or.size > 0) withGenresOr = Array.from(or).join('|');
  }

  const withGenresSlider100Pipe = buildSlider100PrimaryGenrePipe(filters);

  return {
    withKeywordIds: [],
    withoutKeywordIds: [],
    withGenresOr,
    withGenresSlider100Pipe,
    withoutGenres: withoutGenres.size > 0 ? Array.from(withoutGenres).join(',') : undefined,
  };
}

/**
 * One **primary** TMDB genre per Energy axis at slider 100 (big famous pool, e.g. Romance 10749).
 * Multi-axis at 100 → pipe-OR in discover when the user picked no UI genres.
 */
export function buildSlider100PrimaryGenrePipe(filters: FilterState): string | undefined {
  const SLIDER_100_PRIMARY: Record<(typeof ENERGY_AXES)[number], number> = {
    pacing: GENRE_NAME_TO_ID.Action,
    cryMeter: GENRE_NAME_TO_ID.Drama,
    humor: GENRE_NAME_TO_ID.Comedy,
    romance: GENRE_NAME_TO_ID.Romance,
    suspense: GENRE_NAME_TO_ID.Thriller,
  };
  const ids = new Set<number>();
  for (const ax of ENERGY_AXES) {
    if (filters[ax] === 100) ids.add(SLIDER_100_PRIMARY[ax]);
  }
  if (ids.size === 0) return undefined;
  return Array.from(ids).join('|');
}

/** @deprecated Use `buildSmartHarvestAugmentation(...).withGenresSlider100Pipe` — alias for logging / backup. */
export function anchorGenreOrPipeForSlider100(filters: FilterState): string | undefined {
  return buildSlider100PrimaryGenrePipe(filters);
}

export function anyEnergySliderAt100(filters: FilterState): boolean {
  return (
    filters.pacing === 100 ||
    filters.cryMeter === 100 ||
    filters.humor === 100 ||
    filters.romance === 100 ||
    filters.suspense === 100
  );
}
