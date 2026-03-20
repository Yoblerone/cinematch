/**
 * TMDB integration for Cinematch.
 * Get an API key at https://www.themoviedb.org/settings/api and set TMDB_API_KEY in .env.local.
 */

import type { Movie, Genre, Decade, Runtime, Theme, VisualStyle, Soundtrack } from './types';

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

/** TMDB keyword IDs for 18 Theme/Mood tags (discover with_keywords). */
export const THEME_TO_KEYWORD_ID: Partial<Record<Theme, number>> = {
  'Cult Classic': 10683,
  'Adrenaline': 9748,
  'Speculative': 9882,
  'The Dark Side': 2791,
  'Human Condition': 10683,
  'Based on True Story': 9672,
  'Twist Ending': 185014,
  'Road Trip': 7312,
  'Fish out of Water': 10683,
  'Against the Clock': 9748,
  'Identity Crisis': 10683,
  'Whimsical': 181182,
  'Heartfelt': 10683,
  'Cynical': 210710,
  'Philosophical': 10683,
  'Satirical': 9715,
  'Surreal': 345821,
  'Melancholy': 10683,
};

/** TMDB keyword IDs for 18 Visual Moods (discover with_keywords). */
export const VISUAL_STYLE_TO_KEYWORD_ID: Partial<Record<VisualStyle, number>> = {
  'Noir Shadows': 801,
  'Neon Dystopia': 9715,
  'Found Footage': 9807,
  'Technicolor Dream': 2791,
  'Symmetric Frames': 2791,
  'Gritty Realism': 1701,
  'Wide Scope Epic': 2590,
  'Gothic Horror': 819,
  'Retro Grain': 9683,
  'One-Take': 9794,
  'Handheld Kinetic': 9807,
  'Pop Art': 9715,
  'High Contrast': 2791,
  'Period': 9683,
  'Warm Tones': 4485,
  'Cold Tones': 9715,
  'Saturated': 2791,
  'Aerial': 2590,
};

/** TMDB keyword IDs for 18 Sound Profile tags (discover with_keywords). */
export const SOUNDTRACK_TO_KEYWORD_ID: Partial<Record<Soundtrack, number>> = {
  'Sweeping Orchestral': 2791,
  'The Modern Pulse': 9715,
  'Vintage/Analog': 9683,
  'Intimate/Acoustic': 10683,
  'Experimental': 181182,
  'Jazz': 9683,
  'Orchestral': 2791,
  'Ambient': 181182,
  'Synth': 9715,
  'World Music': 10683,
  'Acoustic': 10683,
  'Percussion-heavy': 9748,
  'Vocal-led': 10683,
  'Minimal': 181182,
  'Classical': 2791,
  'Silent': 9683,
  'No Score': 181182,
  'Diegetic Only': 2791,
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
  /** When set, combined in with_keywords for sound/music. */
  soundtrack?: Soundtrack[];
  /** Best Picture is handled by strict local ID fetch; no TMDB keyword. Kept for type compatibility. */
  oscarFilter?: 'any' | 'nominee' | 'winner' | 'both';
  page?: number;
  /** vote_count.desc (default), vote_average.desc, or popularity.desc for A-List / high-profile. */
  sortBy?: 'vote_count.desc' | 'vote_average.desc' | 'popularity.desc';
  /** Director prominence: force lesser-known (low) or heavy hitters (high) at API level. */
  voteCountGte?: number;
  voteCountLte?: number;
  popularityLte?: number;
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
  const soundtrackIds = (params.soundtrack ?? [])
    .map((s) => SOUNDTRACK_TO_KEYWORD_ID[s])
    .filter((id): id is number => id != null);
  /* Best Picture: strict local list only — no with_keywords (234473/250481) to avoid technical winners. */
  const allKeywordIds = Array.from(new Set([...themeIds, ...visualIds, ...soundtrackIds]));
  if (allKeywordIds.length > 0) q.with_keywords = allKeywordIds.join('|');
  if (params.page != null) q.page = String(params.page);
  if (params.voteCountGte != null) q['vote_count.gte'] = String(params.voteCountGte);
  if (params.voteCountLte != null) q['vote_count.lte'] = String(params.voteCountLte);
  if (params.popularityLte != null) q['popularity.lte'] = String(params.popularityLte);
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
    starPowerScore: 0,
    criticsVsFans: 'both',
    oscarWinner: false,
    oscarNominee: false,
    runtimeMinutes: 0,
    directorProminence: 0,
    popularity: 0,
    voteCount: 0,
  };
}
