import type { FilterState, Movie } from './types';

/** Prior mean rating (TMDB-scale) for Bayesian shrinkage in “Both” mode. */
export const BAYESIAN_PRIOR_RATING_C = 6.9;

/** Prior “pseudo-votes” so low-N titles regress toward C; matches formula denominator. */
export const BAYESIAN_PRIOR_WEIGHT_M = 500;

/**
 * Bayesian / IMDb-style weighted rating for “Both”:
 * ((vote_average × vote_count) + (m × C)) / (vote_count + m)
 */
export function bayesianWeightedRating(
  voteAverage: number,
  voteCount: number,
  m: number = BAYESIAN_PRIOR_WEIGHT_M,
  C: number = BAYESIAN_PRIOR_RATING_C
): number {
  const v = Math.max(0, Math.min(10, voteAverage));
  const n = Math.max(0, voteCount);
  return (v * n + m * C) / (n + m);
}

/**
 * UI label **Top Rated** (`criticsVsFans === 'both'`). TMDB has no separate critic vs audience scores;
 * we blend **vote_average** (quality / “critic” proxy) with **log-scaled vote_count** (fan engagement proxy).
 * Discover pools for **Star Power** / **Top Rated** are built server-side (`getTmdbMatches` → TMDB).
 * Returns ~0–100 for match % normalization in `filterMovies`.
 */
export function combinedTopRatedMatchScore(movie: Movie): number {
  const rating = Math.max(0, Math.min(10, movie.rating ?? 0));
  const n = Math.max(0, movie.voteCount ?? 0);
  const criticNorm = rating / 10;
  const fanNorm = Math.min(1, Math.log10(1 + n) / Math.log10(1 + 20_000));
  return ((criticNorm + fanNorm) / 2) * 100;
}

/**
 * Final multiplier on (prominence × 10000 + taste) so Critics / Fans
 * reorder results after genre + cast/director scoring.
 *
 * “Top Rated” mode (`both`) uses `combinedTopRatedMatchScore` in `filterMovies` — this returns 1.
 *
 * Uses TMDB fields: `movie.rating` = vote_average (0–10), `movie.voteCount` = vote_count.
 */
export function criticsFansMultiplier(movie: Movie, filters: FilterState): number {
  if (filters.criticsVsFans == null || filters.criticsVsFans === 'both') return 1;

  const v = movie.rating ?? 0;
  const n = Math.max(0, movie.voteCount ?? 0);
  const logN = Math.log10(Math.max(1, n));

  switch (filters.criticsVsFans) {
    case 'critics': {
      /** High star rating; discover uses min 500 votes — down-weight if below that. */
      if (n < 500) return 0.55 + (v / 10) * 0.25;
      return 0.88 + (v / 10) * 0.4;
    }
    case 'fans': {
      /** Emphasize vote volume + rating; extra lift for “blockbuster consensus” band. */
      let m = 0.85 + (logN / 6) * 0.55 + (v / 10) * 0.2;
      if (n >= 5000 && v >= 7) m += 0.45;
      return Math.min(2.6, m);
    }
    default:
      return 1;
  }
}

/** @deprecated Use bayesianWeightedRating for “Both”. Kept for any external callers. */
export function criticsFansWeightedScore(voteAverage: number, voteCount: number): number {
  const v = Math.max(0, Math.min(10, voteAverage));
  const logN = Math.log10(Math.max(1, voteCount));
  return v * 0.7 + logN * 0.3;
}
