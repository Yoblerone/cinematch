/**
 * Era filter helpers (historical decades + rolling "New Releases" window).
 */

import type { Decade } from './types';

/** Rolling window for the `new-releases` era chip. */
export const NEW_RELEASES_WINDOW_DAYS = 180;

export type HistoricalEra = Exclude<Decade, null | 'new-releases'>;

export const HISTORICAL_ERA_YEAR_RANGES: Record<HistoricalEra, [number, number]> = {
  '60s': [1960, 1969],
  '70s': [1970, 1979],
  '80s': [1980, 1989],
  '90s': [1990, 1999],
  '2000s': [2000, 2009],
  '2010s': [2010, 2019],
  '2020s': [2020, 2030],
};

export const HISTORICAL_ERA_DATE_RANGES: Record<HistoricalEra, { gte: string; lte: string }> = {
  '60s': { gte: '1960-01-01', lte: '1969-12-31' },
  '70s': { gte: '1970-01-01', lte: '1979-12-31' },
  '80s': { gte: '1980-01-01', lte: '1989-12-31' },
  '90s': { gte: '1990-01-01', lte: '1999-12-31' },
  '2000s': { gte: '2000-01-01', lte: '2009-12-31' },
  '2010s': { gte: '2010-01-01', lte: '2019-12-31' },
  '2020s': { gte: '2020-01-01', lte: '2030-12-31' },
};

/** Wizard + Director's Slate era chips (order preserved). */
export const ERA_CHIP_OPTIONS: { value: HistoricalEra | 'new-releases'; label: string }[] = [
  { value: '60s', label: '60s' },
  { value: '70s', label: '70s' },
  { value: '80s', label: '80s' },
  { value: '90s', label: '90s' },
  { value: '2000s', label: '2000s' },
  { value: '2010s', label: '2010s' },
  { value: '2020s', label: '2020s' },
  { value: 'new-releases', label: 'New Releases' },
];

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isNewReleasesEra(era: Decade): era is 'new-releases' {
  return era === 'new-releases';
}

export function isHistoricalEra(era: Decade): era is HistoricalEra {
  return era != null && era !== 'new-releases';
}

/** TMDB Discover `primary_release_date.*` bounds for selected eras (union). */
export function resolveEraDiscoverDateBounds(
  eras: Decade[],
  refDate: Date = new Date()
): { gte: string; lte: string } | null {
  const valid = eras.filter((d): d is NonNullable<Decade> => d != null);
  if (valid.length === 0) return null;

  const ranges: { gte: string; lte: string }[] = [];
  for (const era of valid) {
    if (isNewReleasesEra(era)) {
      const lte = new Date(refDate);
      const gte = new Date(refDate);
      gte.setUTCDate(gte.getUTCDate() - NEW_RELEASES_WINDOW_DAYS);
      ranges.push({ gte: toIsoDate(gte), lte: toIsoDate(lte) });
    } else if (isHistoricalEra(era)) {
      ranges.push(HISTORICAL_ERA_DATE_RANGES[era]);
    }
  }
  if (ranges.length === 0) return null;

  const gte = ranges.map((r) => r.gte).sort()[0];
  const lte = ranges.map((r) => r.lte).sort().reverse()[0];
  return { gte, lte };
}

function parseReleaseDate(releaseDate: string | null | undefined): Date | null {
  if (!releaseDate?.trim()) return null;
  const d = new Date(releaseDate.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

/** True when the film's release falls inside the rolling New Releases window. */
export function movieMatchesNewReleases(
  movie: { year: number; releaseDate?: string | null },
  refDate: Date = new Date()
): boolean {
  const released = parseReleaseDate(movie.releaseDate);
  if (released) {
    const floor = new Date(refDate);
    floor.setUTCDate(floor.getUTCDate() - NEW_RELEASES_WINDOW_DAYS);
    return released >= floor && released <= refDate;
  }
  // Fallback when only calendar year is known (include prior year for 180-day windows).
  const floor = new Date(refDate);
  floor.setUTCDate(floor.getUTCDate() - NEW_RELEASES_WINDOW_DAYS);
  return movie.year >= floor.getUTCFullYear();
}

/** User picked only the rolling New Releases chip (discover already applied the date window). */
export function eraSelectionIsOnlyNewReleases(eras: Decade[]): boolean {
  const valid = eras.filter((d): d is NonNullable<Decade> => d != null);
  return valid.length === 1 && valid[0] === 'new-releases';
}

/** Client-side / post-enrich hard filter: any selected era matches (OR). */
export function movieMatchesEra(
  movie: { year: number; releaseDate?: string | null },
  eras: Decade[],
  refDate: Date = new Date()
): boolean {
  const valid = eras.filter((d): d is NonNullable<Decade> => d != null);
  if (valid.length === 0) return true;

  return valid.some((era) => {
    if (isNewReleasesEra(era)) return movieMatchesNewReleases(movie, refDate);
    if (isHistoricalEra(era)) {
      const [min, max] = HISTORICAL_ERA_YEAR_RANGES[era];
      return movie.year >= min && movie.year <= max;
    }
    return false;
  });
}

/** Human-readable era list for exports / prompts. */
export function formatEraList(eras: Decade[]): string {
  return eras
    .filter((d): d is NonNullable<Decade> => d != null)
    .map((d) => (d === 'new-releases' ? 'New Releases' : d))
    .join(', ');
}

/** True when the user selected the rolling New Releases era chip. */
export function filterIncludesNewReleases(eras: Decade[]): boolean {
  return eras.some((d) => d != null && isNewReleasesEra(d));
}

/**
 * Discover tuning for New Releases: lower than the catalog default (500) but not zero —
 * zero surfaces obscure same-day TMDB dumps with no audience signal.
 */
export const NEW_RELEASES_DISCOVER_VOTE_FLOOR = 25;

/** Minimum TMDB popularity for Discover (filters micro-releases). */
export const NEW_RELEASES_DISCOVER_POPULARITY_FLOOR = 2;

/** Post-fetch / post-enrich quality gate (matches seed catalog). */
export const NEW_RELEASES_MIN_VOTE_COUNT = 10;

export function passesNewReleasesCatalogGate(movie: {
  posterPath?: string | null;
  overview?: string | null;
  voteCount?: number;
}): boolean {
  const poster = movie.posterPath;
  if (poster == null || String(poster).trim() === '') return false;
  if (!(movie.overview?.trim())) return false;
  if ((movie.voteCount ?? 0) < NEW_RELEASES_MIN_VOTE_COUNT) return false;
  return true;
}

export function applyNewReleasesDiscoverOverrides<T extends {
  sortBy?: string;
  voteCountGte?: number;
  voteCountLte?: number;
  voteAverageGte?: number;
  popularityGte?: number;
  popularityLte?: number;
}>(params: T): T {
  return {
    ...params,
    sortBy: 'popularity.desc',
    voteCountGte: NEW_RELEASES_DISCOVER_VOTE_FLOOR,
    popularityGte: NEW_RELEASES_DISCOVER_POPULARITY_FLOOR,
    voteCountLte: undefined,
    voteAverageGte: undefined,
    popularityLte: undefined,
  };
}

/** Oscar ceremony years to include when era filters are active (union of selected eras). */
export function oscarCeremonyYearsForEras(eras: Decade[], refDate: Date = new Date()): Set<number> | null {
  const valid = eras.filter((d): d is NonNullable<Decade> => d != null);
  if (valid.length === 0) return null;

  const years = new Set<number>();
  for (const era of valid) {
    if (isNewReleasesEra(era)) {
      years.add(refDate.getUTCFullYear());
      years.add(refDate.getUTCFullYear() - 1);
    } else if (isHistoricalEra(era)) {
      const [min, max] = HISTORICAL_ERA_YEAR_RANGES[era];
      for (let y = min; y <= max; y++) years.add(y);
    }
  }
  return years;
}
