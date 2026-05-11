import type { FilterState, Movie, Decade, ResultsDisclaimer, ResultsDisclaimerHint, TmdbMatchResponse } from './types';
import { parseTmdbMovieId } from './tmdb';
import { isOscarListedId, isOscarNomineeId, isOscarWinnerId } from './data/oscar-truth';
import { movieHasAllSelectedGenres } from './filterMovies';
const DECADE_RANGES: Record<string, [number, number]> = {
  '60s': [1960, 1969],
  '70s': [1970, 1979],
  '80s': [1980, 1989],
  '90s': [1990, 1999],
  '2000s': [2000, 2009],
  '2010s': [2010, 2019],
  '2020s': [2020, 2030],
};

function decadeMatch(movieYear: number, decades: FilterState['decade']): boolean {
  const valid = decades.filter((d): d is NonNullable<Decade> => d != null);
  if (valid.length === 0) return true;
  return valid.some((d) => {
    const range = DECADE_RANGES[d];
    return range && movieYear >= range[0] && movieYear <= range[1];
  });
}

function runtimeMatch(runtimeMinutes: number, runtime: FilterState['runtime']): boolean {
  if (runtime == null) return true;
  if (runtime === 'short') return runtimeMinutes < 90;
  if (runtime === 'medium') return runtimeMinutes >= 90 && runtimeMinutes <= 150;
  return runtimeMinutes > 150;
}

/** Best Picture chip vs truth list (stable for backfill rows that may lack badge fields). */
export function matchesOscarChip(movie: Movie, oscar: FilterState['oscarFilter']): boolean {
  if (oscar == null) return true;
  const id = parseTmdbMovieId(movie.id);
  if (!Number.isFinite(id) || id <= 0) return false;
  if (oscar === 'winner') return isOscarWinnerId(id);
  if (oscar === 'nominee') return isOscarNomineeId(id);
  if (oscar === 'both') return isOscarListedId(id);
  return true;
}

/**
 * Hard filters for ordering + disclaimer: genre AND, decade, runtime (unknown minutes never fails),
 * crowd, Oscar chip.
 */
export function passesFullHardIntent(movie: Movie, filters: FilterState): boolean {
  if (filters.crowd != null && !movie.crowd.includes(filters.crowd)) return false;
  if (filters.genre.length > 0 && !movieHasAllSelectedGenres(movie, filters)) return false;
  if (filters.decade.length > 0 && !decadeMatch(movie.year, filters.decade)) return false;
  if (
    filters.runtime != null &&
    movie.runtimeMinutes > 0 &&
    !runtimeMatch(movie.runtimeMinutes, filters.runtime)
  ) {
    return false;
  }
  if (!matchesOscarChip(movie, filters.oscarFilter)) return false;
  return true;
}

function collectHintsForMovie(movie: Movie, filters: FilterState): ResultsDisclaimerHint[] {
  const out: ResultsDisclaimerHint[] = [];
  if (filters.runtime != null && movie.runtimeMinutes > 0 && !runtimeMatch(movie.runtimeMinutes, filters.runtime)) {
    out.push('runtime');
  }
  if (filters.decade.length > 0 && !decadeMatch(movie.year, filters.decade)) {
    out.push('decade');
  }
  if (filters.oscarFilter != null && !matchesOscarChip(movie, filters.oscarFilter)) {
    out.push('oscar');
  }
  return out;
}

export type FinalizeOptions = {
  relaxedOscarPadding?: boolean;
};

const TARGET_GRID = 36;

/**
 * Strict matches first (preserve score order within each band), then softer matches, capped at 36.
 * Builds disclaimer when runtime, decade, or Oscar filters are on and the list required compromise.
 */
export function finalizeMatchPresentation(
  movies: Movie[],
  filters: FilterState,
  opts?: FinalizeOptions
): TmdbMatchResponse {
  const strict = movies.filter((m) => passesFullHardIntent(m, filters));
  const loose = movies.filter((m) => !passesFullHardIntent(m, filters));
  const merged = [...strict, ...loose].slice(0, TARGET_GRID);

  const hardIntentOn =
    filters.runtime != null || filters.decade.length > 0 || filters.oscarFilter != null;

  if (!hardIntentOn) {
    return { movies: merged, disclaimer: null };
  }

  const hints = new Set<ResultsDisclaimerHint>();
  if (opts?.relaxedOscarPadding && filters.oscarFilter != null) {
    hints.add('oscar');
  }
  for (const m of loose) {
    for (const h of collectHintsForMovie(m, filters)) hints.add(h);
  }

  const show = Boolean(opts?.relaxedOscarPadding || hints.size > 0);
  const disclaimer: ResultsDisclaimer | null = show
    ? {
        show: true,
        hints: Array.from(hints),
        relaxedOscar: Boolean(opts?.relaxedOscarPadding),
      }
    : null;

  return { movies: merged, disclaimer };
}
