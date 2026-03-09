import type { Movie, FilterState } from './types';
import { movies } from './mockData';

const CULT_POPULARITY_MIN = 5;
const CULT_VOTE_COUNT_MIN = 1000;
const CULT_VOTE_COUNT_MAX = 15000;
const CULT_RATING_MIN = 7.0;
const CULT_AGE_YEARS = 10;

/** Cult Signature: longevity (high popularity today + 10+ years old) + devotion (rating > 7, vote count in cult range). */
export function hasCultSignature(m: {
  popularity?: number;
  voteCount?: number;
  rating: number;
  year: number;
}): boolean {
  const year = m.year || 0;
  const currentYear = new Date().getFullYear();
  const longevity = year > 0 && currentYear - year >= CULT_AGE_YEARS && (m.popularity ?? 0) >= CULT_POPULARITY_MIN;
  const devotion =
    m.rating > CULT_RATING_MIN &&
    (m.voteCount ?? 0) >= CULT_VOTE_COUNT_MIN &&
    (m.voteCount ?? 0) <= CULT_VOTE_COUNT_MAX;
  return longevity && devotion;
}

const BAND = 35;
const DECADE_RANGES: Record<string, [number, number]> = {
  '60s': [1960, 1969], '70s': [1970, 1979], '80s': [1980, 1989], '90s': [1990, 1999],
  '2000s': [2000, 2009], '2010s': [2010, 2019], '2020s': [2020, 2030],
};

function inBand(movieVal: number, filterVal: number): boolean {
  return movieVal >= filterVal - BAND && movieVal <= filterVal + BAND;
}

function decadeMatch(movieYear: number, decades: FilterState['decade']): boolean {
  const valid = decades.filter((d): d is NonNullable<typeof d> => d != null);
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

function scoreMovie(movie: Movie, filters: FilterState): number {
  let score = 0;
  if (filters.crowd != null && movie.crowd.includes(filters.crowd)) score += 2;
  for (const key of ['pacing', 'cryMeter', 'humor', 'romance', 'suspense'] as const) {
    if (inBand(movie[key], filters[key])) score += 1;
    score += (30 - Math.min(Math.abs(movie[key] - filters[key]), 30)) / 30;
  }
  if (filters.visualStyle.length > 0) {
    const m = filters.visualStyle.filter((vs) => movie.visualStyle.includes(vs)).length;
    score += m * 4;
  }
  if (filters.soundtrack.length > 0) {
    const m = filters.soundtrack.filter((st) => movie.soundtrack.includes(st)).length;
    score += m * 4;
  }
  if (filters.theme.length > 0) {
    const m = filters.theme.filter((t) => movie.theme.includes(t)).length;
    score += m * 4;
  }
  if (filters.genre.length > 0) {
    const matchCount = filters.genre.filter((g) => movie.genre.includes(g)).length;
    if (matchCount > 0) score += 2 + matchCount * 2;
  }
  if (filters.oscarWinner === true && movie.oscarWinner) score += 1;
  if (filters.oscarNominee === true && movie.oscarNominee) score += 1;
  if (filters.decade.length > 0 && decadeMatch(movie.year, filters.decade)) score += 1;
  if (filters.runtime != null && runtimeMatch(movie.runtimeMinutes, filters.runtime)) score += 1;
  if (filters.directorProminence > 0 && movie.directorProminence >= filters.directorProminence) score += 4;
  /* Hidden Gem boost: when Cult Classic is on, prioritize huge gap between initial box office and current status. */
  if (filters.cultClassic === true && hasCultSignature(movie)) {
    const pop = (movie.popularity ?? 0) + 1;
    const boxOffice = movie.boxOffice + 1;
    const gap = Math.log(pop) * (movie.budget > 0 ? Math.min(10, movie.budget / boxOffice) : 1);
    score += Math.min(8, gap);
  }
  return score;
}

export function filterMovies(movieList: Movie[], filters: FilterState): Movie[] {
  const filtered = movieList.filter((movie) => {
    /* Best Picture winner: strict filter. When Yes, only actual winners; when No, exclude winners. Empty result if none match. */
    if (filters.oscarWinner === true && !movie.oscarWinner) return false;
    if (filters.oscarWinner === false && movie.oscarWinner) return false;
    if (filters.oscarNominee === true && !movie.oscarNominee) return false;
    if (filters.oscarNominee === false && movie.oscarNominee) return false;
    if (filters.crowd != null && !movie.crowd.includes(filters.crowd)) return false;
    if (filters.genre.length > 0 && !filters.genre.some((g) => movie.genre.includes(g))) return false;
    /* Theme, visual style, soundtrack: scoring-only so mood never returns 0; matches rank at top */
    const cult = hasCultSignature(movie);
    if (filters.cultClassic === true && !cult) return false;
    if (filters.cultClassic === false && cult) return false;
    if (filters.aListCast === true && !movie.hasAListCast) return false;
    if (filters.aListCast === false && movie.hasAListCast) return false;
    if (filters.criticsVsFans != null && movie.criticsVsFans !== filters.criticsVsFans) return false;
    if (filters.decade.length > 0 && !decadeMatch(movie.year, filters.decade)) return false;
    if (filters.runtime != null && !runtimeMatch(movie.runtimeMinutes, filters.runtime)) return false;
    /* Director prominence: scoring-only so we never return zero results; movies that meet the bar rank higher */
    return true;
  });
  const withScores = filtered.map((m) => ({ movie: m, score: scoreMovie(m, filters) }));
  withScores.sort((a, b) => b.score - a.score);
  return withScores.map((x) => x.movie);
}

/** Filter using the default mock movie list (for fallback when TMDB is unavailable). */
export function filterMoviesWithMock(filters: FilterState): Movie[] {
  return filterMovies(movies, filters);
}

export { movies };
