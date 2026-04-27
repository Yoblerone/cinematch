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

/** Smart Harvest (Energy sliders) — merged in `buildDiscoverSearchParams`. */
export type SmartHarvestQuerySlice = {
  /** @deprecated Discover now uses `withKeywordsOr`; kept for tooling. */
  withKeywordIds: number[];
  /** @deprecated Use `withoutKeywordsOr`. */
  withoutKeywordIds: number[];
  /**
   * Pipe-OR TMDB keyword IDs for `with_keywords` (high-band / tiered intent).
   * @see https://developer.themoviedb.org/reference/discover-movie
   */
  withKeywordsOr?: string;
  /** Pipe-OR TMDB keyword IDs for `without_keywords` (low-band negative guardrails). */
  withoutKeywordsOr?: string;
  /**
   * Pipe-OR `with_genres` when user picked no genres — sliders **81–99** only (100 uses `withGenresSlider100Pipe`).
   */
  withGenresOr?: string;
  /**
   * Primary TMDB genre id per Energy axis pinned at **100** (e.g. Romance 10749), joined with `|`.
   * Discover merges this with user genres (AND) or alone as OR for a large famous pool.
   */
  withGenresSlider100Pipe?: string;
  /**
   * Extra genre IDs that must be included (comma-AND with user genres and each other).
   * Cry 80–100 → Drama (18); pacing low → 18+10749; etc.
   */
  withGenresAndComma?: string;
  /** Comma `without_genres`. */
  withoutGenres?: string;
  /** Narrow Discover runtime (merged with user runtime band; invalid combos fall back to user-only). */
  withRuntimeGte?: number;
  withRuntimeLte?: number;
  /** Comma-separated genre IDs placed first in `with_genres` (TMDB ordering / relevance bias). */
  genrePrimaryHeadComma?: string;
};

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
  /** Up to 3; `with_genres` join: comma = AND, pipe = OR. */
  genre?: Genre[];
  /** Default `and`. Use `or` only when AND returns too few results (fallback). */
  genreJoinMode?: 'and' | 'or';
  /** Multiple decades; we use min date–max date range. */
  decade?: (Decade & {})[];
  runtime: Runtime;
  /** Best Picture is handled by strict local ID fetch; no TMDB keyword. Kept for type compatibility. */
  oscarFilter?: 'nominee' | 'winner' | 'both';
  page?: number;
  /** Default in builder is quality-first (`vote_average.desc`); also vote_count.desc, popularity.desc, primary_release_date. */
  sortBy?:
    | 'vote_count.desc'
    | 'vote_count.asc'
    | 'vote_average.desc'
    | 'popularity.desc'
    | 'popularity.asc'
    | 'revenue.desc'
    | 'primary_release_date.desc'
    | 'primary_release_date.asc';
  /** Director prominence: force lesser-known (low) or heavy hitters (high) at API level. */
  voteCountGte?: number;
  voteCountLte?: number;
  popularityLte?: number;
  /** TMDB discover: minimum popularity (movie-level). */
  popularityGte?: number;
  /** TMDB discover: minimum vote_average (0–10). */
  voteAverageGte?: number;
  /** TMDB discover: maximum vote_average (0–10). */
  voteAverageLte?: number;
  /** Energy sliders → genre OR / `without_genres` only (see `lib/smartHarvest.ts`). */
  smartHarvest?: SmartHarvestQuerySlice;
  /** Filter by country of origin. 'us' = US only; 'international' = exclude US. */
  originCountry?: 'us' | 'international' | null;
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

function mergeSmartHarvestGenrePipes(anchor?: string, supplement?: string): Set<number> {
  const s = new Set<number>();
  for (const pipe of [anchor, supplement]) {
    if (!pipe) continue;
    for (const x of pipe.split('|')) {
      const n = Number(String(x).trim());
      if (Number.isFinite(n)) s.add(n);
    }
  }
  return s;
}

/** Build TMDB Discover URL query string (no api_key; caller adds it server-side). */
export function buildDiscoverSearchParams(params: TmdbDiscoverParams): Record<string, string> {
  /** Default: relevance/quality over popularity loop (`vote_count.gte` avoids one-off home movies). */
  const sortBy = params.sortBy ?? 'vote_average.desc';
  const sh = params.smartHarvest;
  const widenDiscover =
    !!sh &&
    (!!sh.withGenresOr ||
      !!sh.withGenresSlider100Pipe ||
      !!sh.withoutGenres ||
      !!sh.withKeywordsOr ||
      !!sh.withoutKeywordsOr ||
      !!sh.withGenresAndComma ||
      !!sh.genrePrimaryHeadComma);
  const voteGte =
    params.voteCountGte != null ? String(params.voteCountGte) : widenDiscover ? '200' : '500';

  const q: Record<string, string> = {
    sort_by: sortBy,
    'vote_count.gte': voteGte,
    include_adult: 'false',
  };

  /**
   * Keep strict slider-100 anchors separate from optional slider OR hints.
   * `withGenresOr` is only meant for "no user genres selected" widening.
   */
  const sliderGenreIdsStrict = mergeSmartHarvestGenrePipes(sh?.withGenresSlider100Pipe, undefined);
  const sliderGenreIdsOptional = mergeSmartHarvestGenrePipes(undefined, sh?.withGenresOr);

  const andExtraIds = (() => {
    if (!sh?.withGenresAndComma) return [] as number[];
    return sh.withGenresAndComma
      .split(',')
      .map((s) => parseInt(String(s).trim(), 10))
      .filter((n) => Number.isFinite(n));
  })();

  if (params.genre != null && params.genre.length > 0) {
    const ids = params.genre
      .map((g) => GENRE_NAME_TO_ID[g])
      .filter((id): id is number => id != null);
    if (ids.length > 0) {
      /**
       * User genres + slider AND extras (comma). Only slider-100 anchors merge as AND with user.
       * `withGenresOr` widening is intentionally ignored when user selected explicit genres.
       */
      const joiner = params.genreJoinMode === 'or' ? '|' : ',';
      let base: number[];
      if (joiner === ',' || andExtraIds.length > 0) {
        base = Array.from(new Set([...ids, ...andExtraIds]));
      } else {
        base = [...ids];
      }
      if (sliderGenreIdsStrict.size > 0) {
        q.with_genres = Array.from(new Set([...base, ...Array.from(sliderGenreIdsStrict)])).join(',');
      } else if (joiner === ',' || andExtraIds.length > 0) {
        q.with_genres = base.join(',');
      } else {
        q.with_genres = ids.join('|');
      }
    }
  } else if (sliderGenreIdsStrict.size > 0 || sliderGenreIdsOptional.size > 0 || andExtraIds.length > 0) {
    const allOr = new Set<number>([...Array.from(sliderGenreIdsStrict), ...Array.from(sliderGenreIdsOptional)]);
    if (andExtraIds.length > 0 && allOr.size > 0) {
      q.with_genres = Array.from(new Set([...andExtraIds, ...Array.from(allOr)])).join(',');
    } else if (allOr.size > 0) {
      q.with_genres = Array.from(allOr).join('|');
    } else {
      q.with_genres = andExtraIds.join(',');
    }
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
    let gte = range.gte;
    let lte = range.lte;
    if (sh?.withRuntimeGte != null) gte = Math.max(gte, sh.withRuntimeGte);
    if (sh?.withRuntimeLte != null) lte = Math.min(lte, sh.withRuntimeLte);
    if (gte <= lte) {
      q['with_runtime.gte'] = String(gte);
      q['with_runtime.lte'] = String(lte);
    } else {
      q['with_runtime.gte'] = String(range.gte);
      q['with_runtime.lte'] = String(range.lte);
    }
  } else if (sh?.withRuntimeGte != null || sh?.withRuntimeLte != null) {
    const gte = sh.withRuntimeGte ?? 0;
    const lte = sh.withRuntimeLte ?? 400;
    if (gte <= lte) {
      q['with_runtime.gte'] = String(gte);
      q['with_runtime.lte'] = String(lte);
    }
  }
  /**
   * TMDB: comma in `with_keywords` = AND (too strict). Always coerce to pipe OR for numeric keyword IDs.
   */
  const coerceKeywordParamToOr = (raw: string): string =>
    raw
      .split(/[|,]/)
      .map((x) => x.trim())
      .filter((x) => /^\d+$/.test(x))
      .join('|');

  if (sh?.withKeywordsOr) {
    const coerced = coerceKeywordParamToOr(sh.withKeywordsOr);
    if (coerced) q.with_keywords = coerced;
  }
  if (sh?.withoutKeywordsOr) {
    const w = coerceKeywordParamToOr(sh.withoutKeywordsOr);
    if (w) q.without_keywords = w;
  }
  if (params.page != null) q.page = String(params.page);
  if (params.voteCountLte != null) q['vote_count.lte'] = String(params.voteCountLte);
  if (params.popularityLte != null) q['popularity.lte'] = String(params.popularityLte);
  if (params.popularityGte != null) q['popularity.gte'] = String(params.popularityGte);
  if (params.voteAverageGte != null) q['vote_average.gte'] = String(params.voteAverageGte);
  if (params.voteAverageLte != null) q['vote_average.lte'] = String(params.voteAverageLte);
  if (sh?.withoutGenres) q.without_genres = sh.withoutGenres;

  if (params.originCountry === 'us') {
    q.with_origin_country = 'US';
  } else if (params.originCountry === 'international') {
    q.without_origin_country = 'US';
  }

  if (q.with_genres && sh?.genrePrimaryHeadComma?.trim()) {
    const head = sh.genrePrimaryHeadComma
      .split(',')
      .map((s) => parseInt(String(s).trim(), 10))
      .filter((n) => Number.isFinite(n));
    if (head.length > 0) {
      const sep = q.with_genres.includes('|') ? '|' : ',';
      const parts = q.with_genres
        .split(sep)
        .map((s) => parseInt(String(s).trim(), 10))
        .filter((n) => Number.isFinite(n));
      const headSet = new Set(head);
      const tail = parts.filter((id) => !headSet.has(id));
      const ordered = [...head.filter((id, i) => head.indexOf(id) === i), ...tail];
      q.with_genres = ordered.join(sep);
    }
  }

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
    overview: t.overview?.trim() ? t.overview.trim() : undefined,
    tagline: '',
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
