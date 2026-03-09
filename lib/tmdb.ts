/**
 * TMDB integration for Cinematch.
 * Get an API key at https://www.themoviedb.org/settings/api and set TMDB_API_KEY in .env.local.
 */

import type { Movie, Genre, Decade, Runtime, Theme, VisualStyle } from './types';

/** TMDB genre list: https://developer.themoviedb.org/reference/genre-movie-list */
export const GENRE_ID_TO_NAME: Record<number, Genre> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
};

export const GENRE_NAME_TO_ID: Record<Genre, number> = Object.fromEntries(
  (Object.entries(GENRE_ID_TO_NAME) as [string, Genre][]).map(([id, name]) => [name, Number(id)])
) as Record<Genre, number>;

const DECADE_RANGES: Record<NonNullable<Decade>, { gte: string; lte: string }> = {
  '60s': { gte: '1960-01-01', lte: '1969-12-31' },
  '70s': { gte: '1970-01-01', lte: '1979-12-31' },
  '80s': { gte: '1980-01-01', lte: '1989-12-31' },
  '90s': { gte: '1990-01-01', lte: '1999-12-31' },
  '2000s': { gte: '2000-01-01', lte: '2009-12-31' },
  '2010s': { gte: '2010-01-01', lte: '2019-12-31' },
  '2020s': { gte: '2020-01-01', lte: '2030-12-31' },
};

/** Runtime bands: short <90, medium 90–150, long 150+ */
const RUNTIME_RANGES: Record<NonNullable<Runtime>, { gte: number; lte: number }> = {
  short: { gte: 0, lte: 89 },
  medium: { gte: 90, lte: 150 },
  long: { gte: 151, lte: 400 },
};

/** TMDB keyword IDs for themes (used in discover with_keywords for better results). */
export const THEME_TO_KEYWORD_ID: Partial<Record<Theme, number>> = {
  'Coming of Age': 10683,
  'Dystopia': 4565,
  'Revenge': 9748,
  'Time Travel': 818,
  'Road Trip': 2499,
  'Based on True Story': 9683,
  'Noir': 2791,
  'Love Triangle': 4485,
  'Quest': 2590,
  'Survival': 9655,
  'Escape': 2517,
  'Murder': 9725,
  'Detective': 2580,
  'Alien': 9715,
  'Robot': 9794,
  'Superhero': 9715,
  'Zombie': 10314,
  'Heist': 2654,
  'Apocalypse': 2595,
  'Space': 9882,
};

/** TMDB keyword IDs for visual style / mood (discover with_keywords). Only IDs known to exist. */
export const VISUAL_STYLE_TO_KEYWORD_ID: Partial<Record<VisualStyle, number>> = {
  'Film Noir': 9807,
  'Road Movie': 2499,
  'Black and White': 2791,
};

export interface TmdbDiscoverParams {
  /** Up to 3; OR in TMDB. */
  genre?: Genre[];
  /** Multiple decades; we use min date–max date range. */
  decade?: (Decade & {})[];
  runtime: Runtime;
  /** When set, TMDB discover uses with_keywords (OR) for mood/theme. */
  theme?: Theme[];
  /** When set, combined with theme in with_keywords for visual/mood. */
  visualStyle?: VisualStyle[];
  page?: number;
  /** Default vote_count.desc; use vote_average.desc for cult-classic-style (highly rated) discovery. */
  sortBy?: 'vote_count.desc' | 'vote_average.desc';
}

export interface TmdbMovieResult {
  id: number;
  title: string;
  release_date: string;
  vote_average: number;
  poster_path: string | null;
  overview: string | null;
  genre_ids: number[];
}

export interface TmdbDiscoverResponse {
  page: number;
  results: TmdbMovieResult[];
  total_pages: number;
  total_results: number;
}

/** Build TMDB Discover URL query string (no api_key; caller adds it server-side). */
export function buildDiscoverSearchParams(params: TmdbDiscoverParams): Record<string, string> {
  const sortBy = params.sortBy ?? 'vote_count.desc';
  const q: Record<string, string> = {
    sort_by: sortBy,
    'vote_count.gte': '20',
  };
  if (params.genre != null && params.genre.length > 0) {
    const ids = params.genre
      .map((g) => GENRE_NAME_TO_ID[g])
      .filter((id): id is number => id != null);
    if (ids.length > 0) q.with_genres = ids.join('|');
  }
  if (params.decade != null && params.decade.length > 0) {
    const valid = params.decade.filter((d): d is NonNullable<Decade> => d != null);
    if (valid.length > 0) {
      const ranges = valid.map((d) => DECADE_RANGES[d]).filter(Boolean);
      if (ranges.length > 0) {
        const gte = ranges.map((r) => r.gte).sort()[0];
        const lte = ranges.map((r) => r.lte).sort().reverse()[0];
        q['primary_release_date.gte'] = gte;
        q['primary_release_date.lte'] = lte;
      }
    }
  }
  if (params.runtime != null) {
    const range = RUNTIME_RANGES[params.runtime];
    q['with_runtime.gte'] = String(range.gte);
    q['with_runtime.lte'] = String(range.lte);
  }
  const themeIds = (params.theme ?? [])
    .map((t) => THEME_TO_KEYWORD_ID[t])
    .filter((id): id is number => id != null);
  const visualIds = (params.visualStyle ?? [])
    .map((v) => VISUAL_STYLE_TO_KEYWORD_ID[v])
    .filter((id): id is number => id != null);
  const allKeywordIds = Array.from(new Set([...themeIds, ...visualIds]));
  if (allKeywordIds.length > 0) q.with_keywords = allKeywordIds.join('|');
  if (params.page != null) q.page = String(params.page);
  return q;
}

/** Map a TMDB discover result to our Movie type. Uses defaults for fields TMDB doesn't provide. */
export function mapTmdbToMovie(t: TmdbMovieResult): Movie {
  const year = t.release_date ? new Date(t.release_date).getFullYear() : 0;
  const genre: Genre[] = t.genre_ids
    .map((id) => GENRE_ID_TO_NAME[id])
    .filter((g): g is Genre => g != null);
  return {
    id: `tmdb-${t.id}`,
    title: t.title,
    year: year || 0,
    tagline: t.overview?.slice(0, 120) ?? '',
    posterColor: 'from-slate-800 to-amber-900',
    crowd: [],
    pacing: 50,
    intensity: 50,
    cryMeter: 50,
    humor: 50,
    romance: 50,
    suspense: 50,
    genre,
    theme: [],
    visualStyle: [],
    soundtrack: [],
    boxOffice: 0,
    budget: 0,
    rating: typeof t.vote_average === 'number' ? t.vote_average : 0,
    hasAListCast: false,
    criticsVsFans: 'both',
    oscarWinner: false,
    oscarNominee: false,
    runtimeMinutes: 0,
    directorProminence: 0,
    popularity: 0,
    voteCount: 0,
  };
}
