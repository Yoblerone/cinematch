import type { FilterState, Movie, Decade, ResultsDisclaimer, ResultsDisclaimerHint, TmdbMatchResponse } from './types';
import { parseTmdbMovieId } from './tmdb';
import { isOscarListedId, isOscarNomineeId, isOscarWinnerId } from './data/oscar-truth';
import { movieHasAllSelectedGenres } from './filterMovies';
import {
  filterIncludesNewReleases,
  isHistoricalEra,
  movieMatchesEra,
  movieMatchesNewReleases,
} from './era';
import { filterMoviesForOriginalLanguageChoice } from './originalLanguage';
import { movieMatchesRuntime } from './runtime';

export const RESULTS_GRID_SIZE = 36;

function eraMatch(movie: Movie, eras: FilterState['decade']): boolean {
  return movieMatchesEra(movie, eras);
}

function moviePassesLanguage(movie: Movie, filters: FilterState): boolean {
  if (filters.originalLanguage == null) return true;
  return filterMoviesForOriginalLanguageChoice([movie], filters.originalLanguage).length > 0;
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
 * Hard filters for ordering + disclaimer: genre AND, era, runtime (unknown minutes never fails),
 * crowd, Oscar chip. Language is handled in {@link moviePassesStrictGrid}.
 */
export function passesFullHardIntent(movie: Movie, filters: FilterState): boolean {
  if (filters.crowd != null && !movie.crowd.includes(filters.crowd)) return false;
  if (filters.genre.length > 0 && !movieHasAllSelectedGenres(movie, filters)) return false;
  if (filters.decade.length > 0 && !eraMatch(movie, filters.decade)) return false;
  if (
    filters.runtime.length > 0 &&
    movie.runtimeMinutes > 0 &&
    !movieMatchesRuntime(movie.runtimeMinutes, filters.runtime)
  ) {
    return false;
  }
  if (!matchesOscarChip(movie, filters.oscarFilter)) return false;
  return true;
}

/** Full grid intent: hard filters + original-language chip when set. */
export function moviePassesStrictGrid(movie: Movie, filters: FilterState): boolean {
  return passesFullHardIntent(movie, filters) && moviePassesLanguage(movie, filters);
}

/** Released more than {@link NEW_RELEASES_WINDOW_DAYS} ago (outside the New Releases chip). */
export function movieIsOutsideNewReleasesWindow(movie: Movie): boolean {
  return !movieMatchesNewReleases(movie);
}

/** Count of active hard dimensions the movie satisfies (for next-best ordering). */
export function hardMatchCount(movie: Movie, filters: FilterState): number {
  let n = 0;
  if (filters.crowd == null || movie.crowd.includes(filters.crowd)) n++;
  if (filters.genre.length === 0 || movieHasAllSelectedGenres(movie, filters)) n++;
  if (filters.decade.length === 0 || eraMatch(movie, filters.decade)) n++;
  if (
    filters.runtime.length === 0 ||
    movie.runtimeMinutes <= 0 ||
    movieMatchesRuntime(movie.runtimeMinutes, filters.runtime)
  ) {
    n++;
  }
  if (matchesOscarChip(movie, filters.oscarFilter)) n++;
  if (moviePassesLanguage(movie, filters)) n++;
  return n;
}

function collectHintsForMovie(movie: Movie, filters: FilterState): ResultsDisclaimerHint[] {
  const out: ResultsDisclaimerHint[] = [];
  if (filters.originalLanguage != null && !moviePassesLanguage(movie, filters)) {
    out.push('language');
  }
  if (
    filters.runtime.length > 0 &&
    movie.runtimeMinutes > 0 &&
    !movieMatchesRuntime(movie.runtimeMinutes, filters.runtime)
  ) {
    out.push('runtime');
  }
  if (filters.genre.length > 0 && !movieHasAllSelectedGenres(movie, filters)) {
    out.push('genre');
  }
  const eras = filters.decade.filter((d): d is NonNullable<Decade> => d != null);
  if (eras.length > 0) {
    if (filterIncludesNewReleases(eras) && !movieMatchesNewReleases(movie)) {
      out.push('new-releases');
    }
    const historicalEras = eras.filter(isHistoricalEra);
    if (historicalEras.length > 0 && !movieMatchesEra(movie, historicalEras)) {
      out.push('decade');
    }
  }
  if (filters.oscarFilter != null && !matchesOscarChip(movie, filters.oscarFilter)) {
    out.push('oscar');
  }
  return out;
}

export type FinalizeOptions = {
  relaxedOscarPadding?: boolean;
};

const HINT_ORDER: ResultsDisclaimerHint[] = [
  'language',
  'new-releases',
  'genre',
  'decade',
  'runtime',
  'oscar',
];

function resolveDisclaimerInsertAt(merged: Movie[], filters: FilterState): number | null {
  if (filterIncludesNewReleases(filters.decade)) {
    for (let i = 0; i < merged.length; i++) {
      if (movieIsOutsideNewReleasesWindow(merged[i]!)) return i;
    }
    return null;
  }

  const strictCount = merged.filter((m) => moviePassesStrictGrid(m, filters)).length;
  if (strictCount < RESULTS_GRID_SIZE) {
    // Oops after the strict block when we have relaxed rows, or when the grid could not fill to 36.
    if (strictCount < merged.length || merged.length < RESULTS_GRID_SIZE) {
      return strictCount;
    }
  }
  return null;
}

/**
 * Perfect matches first, then in-window next-best, then older-than-180-day titles.
 * The oops card is inserted immediately before the first out-of-window row (not at grid start).
 */
export function finalizeMatchPresentation(
  movies: Movie[],
  filters: FilterState,
  opts?: FinalizeOptions
): TmdbMatchResponse {
  const seen = new Set<string>();
  const candidates: Movie[] = [];
  for (const m of movies) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    candidates.push(m);
  }

  const wantsNewReleases = filterIncludesNewReleases(filters.decade);

  const withMeta = candidates.map((movie, rank) => ({
    movie,
    rank,
    strict: moviePassesStrictGrid(movie, filters),
    matchCount: hardMatchCount(movie, filters),
    outsideNewReleases: wantsNewReleases && movieIsOutsideNewReleasesWindow(movie),
  }));

  withMeta.sort((a, b) => {
    if (a.strict !== b.strict) return a.strict ? -1 : 1;
    if (wantsNewReleases && a.outsideNewReleases !== b.outsideNewReleases) {
      return a.outsideNewReleases ? 1 : -1;
    }
    if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
    const scoreA = a.movie.finalMatchScore ?? 0;
    const scoreB = b.movie.finalMatchScore ?? 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a.rank - b.rank;
  });

  const merged = withMeta.slice(0, RESULTS_GRID_SIZE).map((x) => x.movie);
  const strictMatchCount = merged.filter((m) => moviePassesStrictGrid(m, filters)).length;
  const insertAt = resolveDisclaimerInsertAt(merged, filters);

  const hints = new Set<ResultsDisclaimerHint>();
  if (opts?.relaxedOscarPadding && filters.oscarFilter != null) {
    hints.add('oscar');
  }
  if (insertAt != null) {
    for (let i = insertAt; i < merged.length; i++) {
      for (const h of collectHintsForMovie(merged[i]!, filters)) hints.add(h);
    }
  }

  const sortedHints = HINT_ORDER.filter((h) => hints.has(h));
  const showDisclaimer = insertAt != null;

  const disclaimer: ResultsDisclaimer | null = showDisclaimer
    ? {
        show: true,
        insertAt,
        hints: sortedHints,
        strictMatchCount,
        hasRelaxedFill: insertAt < merged.length,
        relaxedOscar: Boolean(opts?.relaxedOscarPadding),
      }
    : null;

  return { movies: merged, disclaimer };
}
