import type { Movie, FilterState } from './types';

const CULT_POPULARITY_MIN = 5;
const CULT_VOTE_COUNT_MIN = 1000;
const CULT_VOTE_COUNT_MAX = 15000;
const CULT_RATING_MIN = 7.0;
const CULT_AGE_YEARS = 10;

/** Prominence score for ranking: higher popularity and vote_count = more prominent (blockbusters). */
export function prominenceScore(movie: Movie): number {
  const pop = movie.popularity ?? 0;
  const votes = movie.voteCount ?? 0;
  return pop + Math.log10(1 + votes) * 10;
}

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
const ATMOSPHERE_POINTS_PER_TAG = 100;
const CULT_CLASSIC_BUDGET_MAX = 5_000_000; // $5M
const CULT_CLASSIC_YEAR_MAX = 2020; // release before 2020

/** Cult Classic atmosphere: budget < $5M AND revenue > budget AND release < 2020. */
function isCultClassicByNumbers(m: { budget: number; boxOffice: number; year: number }): boolean {
  return (
    m.budget < CULT_CLASSIC_BUDGET_MAX &&
    m.boxOffice > m.budget &&
    m.year > 0 &&
    m.year < CULT_CLASSIC_YEAR_MAX
  );
}

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

/** Cumulative atmosphere score: +100 per selected tag that matches (Cult Classic can match by budget/revenue/year). */
function atmosphereScore(movie: Movie, filters: FilterState): number {
  let total = 0;
  for (const t of filters.theme) {
    const match =
      movie.theme.includes(t) ||
      (t === 'Cult Classic' && isCultClassicByNumbers(movie));
    if (match) total += ATMOSPHERE_POINTS_PER_TAG;
  }
  for (const vs of filters.visualStyle) {
    if (movie.visualStyle.includes(vs)) total += ATMOSPHERE_POINTS_PER_TAG;
  }
  for (const st of filters.soundtrack) {
    if (movie.soundtrack.includes(st)) total += ATMOSPHERE_POINTS_PER_TAG;
  }
  return total;
}

function scoreMovie(movie: Movie, filters: FilterState): number {
  let score = atmosphereScore(movie, filters);
  if (filters.crowd != null && movie.crowd.includes(filters.crowd)) score += 2;
  for (const key of ['pacing', 'cryMeter', 'humor', 'romance', 'suspense'] as const) {
    if (inBand(movie[key], filters[key])) score += 1;
    score += (30 - Math.min(Math.abs(movie[key] - filters[key]), 30)) / 30;
  }
  if (filters.genre.length > 0) {
    const matchCount = filters.genre.filter((g) => movie.genre.includes(g)).length;
    if (matchCount > 0) score += 2 + matchCount * 2;
  }
  /* Pedigree: Best Picture filters (no API keyword checks; we rank within the result set).
   * Nominee = small boost.
   * Winner = big boost.
   * Both = nominees + winners in one selection.
   */
  if (filters.oscarFilter === 'nominee') {
    if (movie.oscarNominee) score += 1;
  }
  if (filters.oscarFilter === 'both') {
    if (movie.oscarNominee) score += 1;
    if (movie.oscarWinner) score += 500;
  }
  if (filters.oscarFilter === 'winner') {
    if (movie.oscarWinner) score += 500;
  }
  if (filters.criticsVsFans != null && movie.criticsVsFans === filters.criticsVsFans) score += 2;
  if (filters.decade.length > 0 && decadeMatch(movie.year, filters.decade)) score += 1;
  if (filters.runtime != null && runtimeMatch(movie.runtimeMinutes, filters.runtime)) score += 1;
  if (!filters.directorProminenceAny && filters.directorProminence > 0 && movie.directorProminence >= filters.directorProminence) score += 4;
  if (!filters.aListCastAny && (movie.starPowerScore ?? 0) > 0) score += 2;
  /* Hidden Gem boost: when Cult Classic filter is on, prioritize cult signature. */
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
    if (filters.crowd != null && !movie.crowd.includes(filters.crowd)) return false;
    if (filters.genre.length > 0 && !filters.genre.some((g) => movie.genre.includes(g))) return false;
    const cult = hasCultSignature(movie);
    if (filters.cultClassic === true && !cult) return false;
    if (filters.cultClassic === false && cult) return false;
    if (filters.decade.length > 0 && !decadeMatch(movie.year, filters.decade)) return false;
    if (filters.runtime != null && !runtimeMatch(movie.runtimeMinutes, filters.runtime)) return false;
    /* Pedigree (Oscar, Critics vs Fans, A-List, Director): rank only, no filtering */
    return true;
  });
  const withScores = filtered.map((m) => ({ movie: m, score: scoreMovie(m, filters) }));
  withScores.sort((a, b) => b.score - a.score);
  let result = withScores.map((x) => x.movie);

  /* Director Prominence: when "Any" is checked, skip. Otherwise rank by prominence. */
  if (filters.directorProminenceAny) return result;

  const dp = filters.directorProminence;
  if (dp >= 75) {
    result = [...result].sort((a, b) => prominenceScore(b) - prominenceScore(a));
  } else if (dp <= 25) {
    /* Strictly lowest popularity and vote_count first. Captain America rule: at 0, popularity > 50 goes to the very bottom. */
    const pop = (m: Movie) => m.popularity ?? 0;
    const votes = (m: Movie) => m.voteCount ?? 0;
    if (dp === 0) {
      const blockbusters = result.filter((m) => pop(m) > 50);
      const rest = result.filter((m) => pop(m) <= 50);
      rest.sort((a, b) => {
        const pa = pop(a), pb = pop(b);
        if (pa !== pb) return pa - pb;
        return votes(a) - votes(b);
      });
      result = [...rest, ...blockbusters];
    } else {
      result = [...result].sort((a, b) => {
        const pa = pop(a), pb = pop(b);
        if (pa !== pb) return pa - pb;
        return votes(a) - votes(b);
      });
    }
  }

  /* A-List Cast (Star Power): when "Any" is unchecked, rank by star power. 100 = highest first, 0 = lowest first. */
  if (!filters.aListCastAny) {
    const starPower = (m: Movie) => m.starPowerScore ?? 0;
    if (filters.aListCast >= 50) {
      result = [...result].sort((a, b) => starPower(b) - starPower(a));
    } else {
      result = [...result].sort((a, b) => starPower(a) - starPower(b));
    }
  }

  /* Oscar Winner priority: when oscarFilter includes winners, sort so winners appear first. */
  if (filters.oscarFilter === 'winner' || filters.oscarFilter === 'both') {
    result = [...result].sort((a, b) => (b.oscarWinner ? 1 : 0) - (a.oscarWinner ? 1 : 0));
  }

  return result;
}
