/**
 * TMDB enrichment: details, keywords, credits → full Movie with real data.
 * Derives pacing, humor, romance, etc. from genre + keywords when TMDB has no direct field.
 */

import type { Movie, Genre, Theme, VisualStyle, Soundtrack, CriticsVsFans } from './types';
import type { FilterState } from './types';
import type { TmdbMovieResult, TmdbDiscoverResponse } from './tmdb';
import { GENRE_ID_TO_NAME, buildDiscoverSearchParams, type SmartHarvestQuerySlice } from './tmdb';
import { anyEnergySliderAt100, buildSmartHarvestAugmentation } from './smartHarvest';
import {
  getOscarWinnerIds,
  getOscarNomineeIds,
  getOscarBothIds,
  isOscarWinnerId,
  isOscarNomineeId,
  isOscarListedId,
  getOscarAwardInfo,
} from './data/oscar-truth';
import { filterMovies, type FilterMoviesOptions } from './filterMovies';
import { combinedTopRatedMatchScore } from './criticsFansRank';
import { PROMINENCE_TRUTH_LIST } from './prominence';
import { prestigeCastMatch, prestigeDirectorMatch } from './prestigeScore';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const CONCURRENCY = 6;

function hasSecondaryFilters(filters: FilterState): boolean {
  if (filters.crowd != null) return true;
  if (filters.genre.length > 0) return true;
  if (filters.theme.length > 0) return true;
  if (filters.visualStyle.length > 0) return true;
  if (filters.soundtrack.length > 0) return true;
  if (filters.cultClassic != null) return true;
  if (!filters.aListCastAny || filters.aListCast !== 50) return true;
  if (filters.criticsVsFans != null) return true;
  if (filters.decade.length > 0) return true;
  if (filters.runtime != null) return true;
  if (!filters.directorProminenceAny || filters.directorProminence !== 50) return true;
  if (filters.pacing !== 50) return true;
  if (filters.intensity !== 50) return true;
  if (filters.cryMeter !== 50) return true;
  if (filters.humor !== 50) return true;
  if (filters.romance !== 50) return true;
  if (filters.suspense !== 50) return true;
  return false;
}

/** Keyword name (lowercase) → 18 Theme/Mood tags. */
function keywordToThemes(name: string): Theme[] {
  const themes: Theme[] = [];
  const n = name.toLowerCase();
  const themeMap: [string, Theme][] = [
    ['cult', 'Cult Classic'],
    ['revenge', 'Adrenaline'], ['action', 'Adrenaline'], ['heist', 'Adrenaline'],
    ['alien', 'Speculative'], ['robot', 'Speculative'], ['space', 'Speculative'], ['time travel', 'Speculative'],
    ['dystopia', 'Speculative'], ['superhero', 'Speculative'], ['apocalypse', 'Speculative'],
    ['noir', 'The Dark Side'], ['murder', 'The Dark Side'], ['serial killer', 'The Dark Side'],
    ['horror', 'The Dark Side'], ['vampire', 'The Dark Side'], ['zombie', 'The Dark Side'],
    ['coming of age', 'Human Condition'], ['identity', 'Human Condition'], ['grief', 'Human Condition'],
    ['loss', 'Human Condition'], ['addiction', 'Human Condition'], ['mental', 'Human Condition'],
    ['found family', 'Human Condition'], ['redemption', 'Human Condition'],
    ['based on true story', 'Based on True Story'], ['true story', 'Based on True Story'],
    ['twist ending', 'Twist Ending'], ['plot twist', 'Twist Ending'],
    ['road trip', 'Road Trip'], ['road movie', 'Road Trip'],
    ['fish out of water', 'Fish out of Water'], ['stranger', 'Fish out of Water'],
    ['against the clock', 'Against the Clock'], ['race against time', 'Against the Clock'], ['deadline', 'Against the Clock'],
    ['identity crisis', 'Identity Crisis'], ['identity', 'Identity Crisis'],
    ['whimsical', 'Whimsical'], ['whimsy', 'Whimsical'],
    ['heartfelt', 'Heartfelt'], ['emotional', 'Heartfelt'],
    ['cynical', 'Cynical'], ['cynicism', 'Cynical'],
    ['philosophical', 'Philosophical'], ['philosophy', 'Philosophical'],
    ['satire', 'Satirical'], ['satirical', 'Satirical'],
    ['surreal', 'Surreal'], ['surrealism', 'Surreal'],
    ['melancholy', 'Melancholy'], ['melancholic', 'Melancholy'], ['sad', 'Melancholy'],
  ];
  for (const [key, theme] of themeMap) {
    if (n.includes(key)) themes.push(theme);
  }
  return themes;
}

/** Keyword name → 18 Visual Moods (TMDB keyword–driven ranking). */
function keywordToVisualStyles(name: string): VisualStyle[] {
  const styles: VisualStyle[] = [];
  const n = name.toLowerCase();
  const styleMap: [string, VisualStyle][] = [
    ['film noir', 'Noir Shadows'], ['noir', 'Noir Shadows'],
    ['cyberpunk', 'Neon Dystopia'], ['neon', 'Neon Dystopia'], ['dystopia', 'Neon Dystopia'],
    ['found footage', 'Found Footage'],
    ['handheld', 'Handheld Kinetic'], ['shaky', 'Handheld Kinetic'],
    ['vibrant', 'Technicolor Dream'], ['stylized', 'Technicolor Dream'], ['technicolor', 'Technicolor Dream'],
    ['symmetric', 'Symmetric Frames'], ['wes anderson', 'Symmetric Frames'], ['balanced', 'Symmetric Frames'],
    ['gritty', 'Gritty Realism'], ['natural light', 'Gritty Realism'], ['realism', 'Gritty Realism'],
    ['cinemascope', 'Wide Scope Epic'], ['epic', 'Wide Scope Epic'], ['wide scope', 'Wide Scope Epic'],
    ['gothic', 'Gothic Horror'], ['horror', 'Gothic Horror'],
    ['period piece', 'Retro Grain'], ['16mm', 'Retro Grain'], ['retro', 'Retro Grain'], ['grain', 'Retro Grain'],
    ['long take', 'One-Take'], ['one take', 'One-Take'],
    ['pop art', 'Pop Art'], ['graphic', 'Pop Art'], ['comic', 'Pop Art'],
    ['high contrast', 'High Contrast'], ['chiaroscuro', 'High Contrast'], ['contrast', 'High Contrast'],
    ['period', 'Period'], ['period piece', 'Period'], ['historical', 'Period'],
    ['warm tone', 'Warm Tones'], ['warm color', 'Warm Tones'], ['golden hour', 'Warm Tones'],
    ['cold tone', 'Cold Tones'], ['cold color', 'Cold Tones'], ['blue tone', 'Cold Tones'],
    ['saturated', 'Saturated'], ['vivid color', 'Saturated'], ['vibrant color', 'Saturated'],
    ['aerial', 'Aerial'], ['drone', 'Aerial'], ['overhead', 'Aerial'], ['from above', 'Aerial'],
  ];
  for (const [key, style] of styleMap) {
    if (n.includes(key)) styles.push(style);
  }
  return styles;
}

/** Keyword name → 18 Sound Profile tags. */
function keywordToSoundtracks(name: string): Soundtrack[] {
  const tracks: Soundtrack[] = [];
  const n = name.toLowerCase();
  const trackMap: [string, Soundtrack][] = [
    ['orchestral', 'Sweeping Orchestral'], ['choir', 'Sweeping Orchestral'], ['score', 'Sweeping Orchestral'],
    ['strings', 'Sweeping Orchestral'], ['orchestra', 'Orchestral'],
    ['electronic', 'The Modern Pulse'], ['electronic music', 'The Modern Pulse'],
    ['synth', 'Synth'], ['synthesizer', 'Synth'],
    ['jazz', 'Jazz'], ['blues', 'Vintage/Analog'], ['rock', 'Vintage/Analog'],
    ['classic songs', 'Vintage/Analog'], ['period', 'Vintage/Analog'],
    ['acoustic', 'Acoustic'], ['piano', 'Intimate/Acoustic'], ['folk', 'Intimate/Acoustic'],
    ['intimate', 'Intimate/Acoustic'],
    ['experimental', 'Experimental'], ['sound design', 'Experimental'], ['ambient', 'Ambient'],
    ['world music', 'World Music'], ['ethnic', 'World Music'],
    ['percussion', 'Percussion-heavy'], ['drum', 'Percussion-heavy'],
    ['vocal', 'Vocal-led'], ['singing', 'Vocal-led'], ['choir', 'Vocal-led'],
    ['minimal', 'Minimal'], ['minimalist', 'Minimal'],
    ['classical', 'Classical'], ['classical music', 'Classical'],
    ['silent', 'Silent'], ['silent film', 'Silent'],
    ['no score', 'No Score'], ['no music', 'No Score'],
    ['diegetic', 'Diegetic Only'], ['source music', 'Diegetic Only'],
  ];
  for (const [key, track] of trackMap) {
    if (n.includes(key)) tracks.push(track);
  }
  return tracks;
}

/** Derive Energy sliders from TMDB genre IDs + keyword names (TMDB has no direct pacing/humor/etc). */
function deriveSliders(
  genreIds: number[],
  keywordNames: string[]
): { pacing: number; intensity: number; cryMeter: number; humor: number; romance: number; suspense: number } {
  let pacing = 50;
  let intensity = 50;
  let cryMeter = 50;
  let humor = 50;
  let romance = 50;
  let suspense = 50;
  const kw = keywordNames.join(' ').toLowerCase();

  if (genreIds.includes(35)) { humor += 28; pacing += 10; }  // Comedy
  if (genreIds.includes(10749)) { romance += 30; }            // Romance
  if (genreIds.includes(27)) { intensity += 25; suspense += 28; }  // Horror
  if (genreIds.includes(53)) { suspense += 25; intensity += 15; } // Thriller
  if (genreIds.includes(28)) { pacing += 22; intensity += 20; }     // Action
  if (genreIds.includes(18)) { cryMeter += 18; }                  // Drama
  if (genreIds.includes(878)) { intensity += 10; suspense += 10; } // Sci-Fi
  if (genreIds.includes(12)) { pacing += 8; }                      // Adventure
  if (genreIds.includes(10402)) { romance += 5; humor += 5; }      // Music

  if (kw.includes('romance')) romance += 15;
  if (kw.includes('comedy') || kw.includes('humor')) humor += 15;
  if (kw.includes('thriller') || kw.includes('suspense')) suspense += 18;
  if (kw.includes('slow') || kw.includes('meditative')) pacing -= 22;
  if (kw.includes('fast') || kw.includes('action')) pacing += 15;
  if (kw.includes('sad') || kw.includes('grief') || kw.includes('loss')) cryMeter += 20;
  if (kw.includes('violence') || kw.includes('intense')) intensity += 15;

  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
  return {
    pacing: clamp(pacing),
    intensity: clamp(intensity),
    cryMeter: clamp(cryMeter),
    humor: clamp(humor),
    romance: clamp(romance),
    suspense: clamp(suspense),
  };
}

export interface TmdbMovieDetails {
  id: number;
  title: string;
  release_date: string;
  vote_average: number;
  vote_count: number;
  popularity?: number;
  poster_path: string | null;
  overview: string | null;
  tagline: string | null;
  runtime: number | null;
  budget: number;
  revenue: number;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  imdb_id?: string | null;
  /** Present when fetching with append_to_response=keywords */
  keywords?: { keywords?: { id: number; name: string }[] };
  /** Present when fetching with append_to_response=videos */
  videos?: { results?: TmdbVideoResult[] };
}

/** TMDB /movie/{id} videos.results[] entry (append_to_response=videos). */
export interface TmdbVideoResult {
  key: string;
  site: string;
  type: string;
  /** Prefer official trailers when multiple exist */
  official?: boolean;
}

/** First TMDB video in `results` where site is YouTube and type is Trailer (case-insensitive). */
export function extractYoutubeTrailerKey(videos: { results?: TmdbVideoResult[] } | undefined): string | null {
  const results = videos?.results ?? [];
  const trailer = results.find((v) => {
    const site = (v.site ?? '').toLowerCase();
    const type = (v.type ?? '').toLowerCase();
    return site === 'youtube' && type === 'trailer';
  });
  const key = trailer?.key?.trim();
  return key ? key : null;
}

export interface TmdbKeywordsResponse {
  keywords: { id: number; name: string }[];
}

export interface TmdbCreditsResponse {
  crew: { id: number; name: string; job: string; popularity: number }[];
  cast: { id: number; name: string; popularity: number; order: number }[];
}

async function fetchTmdb<T>(apiKey: string, path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${TMDB_BASE}${path}${path.includes('?') ? '&' : '?'}api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${path}`);
  return res.json();
}

/** Unique TMDB movie ids in a person’s filmography (cast + crew combined credits). */
async function fetchPersonFilmographyUniqueCount(
  apiKey: string,
  personId: number,
  cache: Map<number, number>
): Promise<number> {
  if (personId <= 0) return 0;
  const hit = cache.get(personId);
  if (hit != null) return hit;
  try {
    const data = await fetchTmdb<{ cast?: { id: number }[]; crew?: { id: number }[] }>(
      apiKey,
      `/person/${personId}/movie_credits`
    );
    const ids = new Set<number>();
    for (const c of data.cast ?? []) {
      if (c.id != null) ids.add(c.id);
    }
    for (const c of data.crew ?? []) {
      if (c.id != null) ids.add(c.id);
    }
    const n = ids.size;
    cache.set(personId, n);
    return n;
  } catch {
    cache.set(personId, 0);
    return 0;
  }
}

/** vote_average high + revenue not dominant → critics; high popularity → fans. */
function criticsVsFans(voteAverage: number, voteCount: number): CriticsVsFans {
  if (voteCount >= 5000 && voteAverage >= 7.8) return 'critics';
  if (voteCount >= 10000) return 'fans';
  return 'both';
}

export async function fetchMovieDetails(apiKey: string, movieId: number): Promise<TmdbMovieDetails | null> {
  try {
    return await fetchTmdb<TmdbMovieDetails>(
      apiKey,
      `/movie/${movieId}?append_to_response=keywords,videos`
    );
  } catch {
    return null;
  }
}

export async function fetchMovieKeywords(apiKey: string, movieId: number): Promise<string[]> {
  try {
    const data = await fetchTmdb<TmdbKeywordsResponse>(apiKey, `/movie/${movieId}/keywords`);
    return (data.keywords ?? []).map((k) => k.name);
  } catch {
    return [];
  }
}

export async function fetchMovieCredits(apiKey: string, movieId: number): Promise<TmdbCreditsResponse | null> {
  try {
    return await fetchTmdb<TmdbCreditsResponse>(apiKey, `/movie/${movieId}/credits`);
  } catch {
    return null;
  }
}

function mergeKeywordNames(fromAppend: string[], fromEndpoint: string[]): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();
  for (const raw of [...fromAppend, ...fromEndpoint]) {
    const n = typeof raw === 'string' ? raw.trim() : '';
    if (!n) continue;
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(n);
  }
  return merged;
}

export async function enrichMovie(
  apiKey: string,
  base: TmdbMovieResult,
  opts?: { creditCountCache?: Map<number, number> }
): Promise<Movie> {
  const [details, credits, keywordsEndpoint] = await Promise.all([
    fetchMovieDetails(apiKey, base.id),
    fetchMovieCredits(apiKey, base.id),
    fetchMovieKeywords(apiKey, base.id),
  ]);

  const fromAppend = (details?.keywords?.keywords ?? []).map((k) => k.name.trim()).filter(Boolean);
  const keywordNames = mergeKeywordNames(fromAppend, keywordsEndpoint);

  const rawGenreIds = details?.genre_ids ?? base.genre_ids ?? [];
  const genreIds = rawGenreIds;
  const genres: Genre[] = genreIds
    .map((id) => GENRE_ID_TO_NAME[id as keyof typeof GENRE_ID_TO_NAME])
    .filter((g): g is Genre => g != null);

  const themes: Theme[] = [];
  const visualStyles: VisualStyle[] = [];
  const soundtracks: Soundtrack[] = [];
  const seenT = new Set<Theme>();
  const seenV = new Set<VisualStyle>();
  const seenS = new Set<Soundtrack>();
  for (const name of keywordNames) {
    for (const t of keywordToThemes(name)) { if (!seenT.has(t)) { seenT.add(t); themes.push(t); } }
    for (const v of keywordToVisualStyles(name)) { if (!seenV.has(v)) { seenV.add(v); visualStyles.push(v); } }
    for (const s of keywordToSoundtracks(name)) { if (!seenS.has(s)) { seenS.add(s); soundtracks.push(s); } }
  }

  const sliders = deriveSliders(genreIds, keywordNames);

  const creditCountCache = opts?.creditCountCache ?? new Map<number, number>();
  const castSorted = [...(credits?.cast ?? [])].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  const top2Cast = castSorted.slice(0, 2);
  const castLeadFilmographyCounts = await Promise.all(
    top2Cast.map((c) => fetchPersonFilmographyUniqueCount(apiKey, c.id, creditCountCache))
  );

  const director = credits?.crew?.find((c) => c.job === 'Director');
  let directorFilmographyCount = 0;
  let directorPopularityRaw = 0;
  if (director?.id) {
    directorPopularityRaw = director.popularity ?? 0;
    directorFilmographyCount = await fetchPersonFilmographyUniqueCount(apiKey, director.id, creditCountCache);
  }

  const aListActorIds = new Set(PROMINENCE_TRUTH_LIST.a_list_actors.map((a) => a.id));
  const hasAListCastFlag =
    top2Cast.some((c) => aListActorIds.has(c.id)) || castLeadFilmographyCounts.some((n) => n >= 20);

  const crewCreditsMapped = (credits?.crew ?? [])
    .filter((c) => c.job === 'Director')
    .map((c) => ({
      id: c.id,
      name: c.name,
      job: c.job,
      popularity: c.popularity ?? 0,
    }));

  const castCreditsMapped = castSorted.slice(0, 5).map((c) => ({
    id: c.id,
    name: c.name,
    popularity: c.popularity ?? 0,
    order: c.order,
  }));

  const prestigePartial = {
    castCredits: castSorted.slice(0, 2).map((c) => ({
      id: c.id,
      name: c.name,
      popularity: c.popularity ?? 0,
      order: c.order,
    })),
    castLeadFilmographyCounts,
    directorFilmographyCount,
    crewCredits: crewCreditsMapped,
  } as Movie;

  const starPowerScoreRounded = Math.round(prestigeCastMatch(prestigePartial, 100, PROMINENCE_TRUTH_LIST));
  const directorProminence = Math.round(prestigeDirectorMatch(prestigePartial, 100, PROMINENCE_TRUTH_LIST));

  const voteAverage = details?.vote_average ?? base.vote_average ?? 0;
  const voteCount = details?.vote_count ?? (base as unknown as { vote_count?: number }).vote_count ?? 0;
  const revenue = details?.revenue ?? 0;
  const budget = details?.budget ?? 0;
  const year = details?.release_date ? new Date(details.release_date).getFullYear() : (base.release_date ? new Date(base.release_date).getFullYear() : 0);
  const popularity = details?.popularity ?? (base as unknown as { popularity?: number }).popularity ?? 0;

  const posterPath = details?.poster_path ?? base.poster_path ?? null;

  return {
    id: `tmdb-${base.id}`,
    title: details?.title ?? base.title,
    year,
    tagline: details?.tagline?.trim() || details?.overview?.slice(0, 100) || '',
    posterColor: 'from-slate-800 to-amber-900',
    posterPath: posterPath ?? undefined,
    crowd: [],
    pacing: sliders.pacing,
    intensity: sliders.intensity,
    cryMeter: sliders.cryMeter,
    humor: sliders.humor,
    romance: sliders.romance,
    suspense: sliders.suspense,
    genre: genres.length ? genres : (base.genre_ids?.map((id) => GENRE_ID_TO_NAME[id]).filter(Boolean) as Genre[]) ?? [],
    genreIds: rawGenreIds.length ? [...rawGenreIds] : undefined,
    /** Always an array so scoring never treats metadata as “missing”. */
    keywordNames: keywordNames.length > 0 ? [...keywordNames] : [],
    theme: themes,
    visualStyle: visualStyles,
    soundtrack: soundtracks,
    boxOffice: revenue,
    budget,
    rating: voteAverage,
    hasAListCast: hasAListCastFlag,
    starPowerScore: starPowerScoreRounded,
    criticsVsFans: criticsVsFans(voteAverage, voteCount),
    oscarWinner: isOscarWinnerId(base.id),
    oscarNominee: isOscarNomineeId(base.id) || isOscarWinnerId(base.id),
    ...((): Partial<Movie> => {
      const info = getOscarAwardInfo(base.id);
      return info ? { academyAwardYear: info.year, academyAwardType: info.type } : {};
    })(),
    runtimeMinutes: details?.runtime ?? 0,
    directorProminence,
    castLeadFilmographyCounts: castLeadFilmographyCounts.length ? castLeadFilmographyCounts : undefined,
    directorFilmographyCount: directorFilmographyCount > 0 ? directorFilmographyCount : undefined,
    directorPopularityRaw: directorPopularityRaw || undefined,
    popularity,
    voteCount,
    imdbId: details?.imdb_id ?? undefined,
    trailerKey: extractYoutubeTrailerKey(details?.videos) ?? null,
    castCredits: castCreditsMapped,
    crewCredits: crewCreditsMapped,
  };
}

/** Params for discover/movie (includes strict AND vs wide OR for genres). */
type DiscoverFetchParams = {
  genre: FilterState['genre'];
  decade: FilterState['decade'];
  runtime: FilterState['runtime'];
  theme: FilterState['theme'];
  visualStyle: FilterState['visualStyle'];
  soundtrack: FilterState['soundtrack'];
  oscarFilter: FilterState['oscarFilter'];
  /** Energy sliders → Discover keyword / genre augmentation (non–Academy paths only). */
  smartHarvest?: SmartHarvestQuerySlice;
  sortBy?:
    | 'vote_count.desc'
    | 'vote_average.desc'
    | 'popularity.desc'
    | 'primary_release_date.desc';
  voteCountGte?: number;
  voteCountLte?: number;
  popularityLte?: number;
  popularityGte?: number;
  voteAverageGte?: number;
  voteAverageLte?: number;
  genreJoinMode?: 'and' | 'or';
};

async function fetchDiscoverRaw(
  apiKey: string,
  params: DiscoverFetchParams,
  page: number
): Promise<TmdbDiscoverResponse> {
  const q = buildDiscoverSearchParams({
    genre: params.genre?.length ? params.genre : undefined,
    genreJoinMode: params.genreJoinMode,
    decade: params.decade?.length ? params.decade.filter((d): d is NonNullable<typeof d> => d != null) : undefined,
    runtime: params.runtime ?? null,
    theme: params.theme?.length ? params.theme : undefined,
    visualStyle: params.visualStyle?.length ? params.visualStyle : undefined,
    soundtrack: params.soundtrack?.length ? params.soundtrack : undefined,
    oscarFilter: params.oscarFilter !== 'any' ? params.oscarFilter : undefined,
    page,
    sortBy: params.sortBy,
    voteCountGte: params.voteCountGte,
    voteCountLte: params.voteCountLte,
    popularityLte: params.popularityLte,
    popularityGte: params.popularityGte,
    voteAverageGte: params.voteAverageGte,
    voteAverageLte: params.voteAverageLte,
    smartHarvest: params.smartHarvest,
  });
  const url = `${TMDB_BASE}/discover/movie?${new URLSearchParams({ ...q, api_key: apiKey }).toString()}`;
  const debugUrl = url.replace(/api_key=[^&]+/, 'api_key=***');
  if (params.oscarFilter === 'winner' || process.env.NODE_ENV !== 'production') {
    console.log('[TMDB Discover]', debugUrl);
    console.log('Final API URL:', debugUrl);
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB Discover ${res.status}`);
  const data = (await res.json()) as TmdbDiscoverResponse;
  if (params.oscarFilter === 'winner') {
    const results = data.results ?? [];
    const total = data.total_results ?? results.length;
    console.log('[TMDB Discover] Winner request: total_results=', total, 'page size=', results.length);
  }
  return data;
}

/** If strict AND returns fewer than this many titles, retry with OR (pipe) for a wider pool. */
const GENRE_FALLBACK_MIN_RESULTS = 10;

/** Second pass without UI genres when pool is thin and a slider is at 100 (wider `with_genres` OR). */
const SLIDER_100_GENRE_BACKUP_MIN_UNIQUE = 40;

/** Deep search: 5 parallel Discover calls (pages 1–5) → up to ~100 rows before dedupe cap. */
const DEEP_SEARCH_PAGES = [1, 2, 3, 4, 5] as const;
export const DEEP_POOL_MAX = 100;

export type GetTmdbMatchesOptions = {
  /** @deprecated Deep search always uses pages 1–5; ignored. */
  discoverStartPage?: number;
};

function dedupeDiscoverRows(rows: TmdbMovieResult[]): TmdbMovieResult[] {
  const byId = new Map<number, TmdbMovieResult>();
  for (const movie of rows) {
    byId.set(movie.id, movie);
  }
  return Array.from(byId.values());
}

/**
 * **Deep API-side search:** 5 simultaneous `/discover/movie` calls (pages 1–5), dedupe, cap at {@link DEEP_POOL_MAX}.
 */
async function harvestDiscoverDeepPages(
  apiKey: string,
  discoverBase: DiscoverFetchParams,
  genreJoinMode: 'and' | 'or'
): Promise<TmdbMovieResult[]> {
  const params = { ...discoverBase, genreJoinMode };
  const allPagesResults = await Promise.all(
    DEEP_SEARCH_PAGES.map((page) => fetchDiscoverRaw(apiKey, params, page))
  );
  const combined = allPagesResults.flatMap((data) => data.results ?? []);
  const unique = dedupeDiscoverRows(combined);
  const capped = unique.slice(0, DEEP_POOL_MAX);
  console.log(
    '[Discover] Deep search pages 1–5: raw rows',
    combined.length,
    'unique',
    unique.length,
    'capped',
    capped.length
  );
  return capped;
}

/** Map Energy sliders (0–100) to a minimum TMDB `vote_average` floor (5.0–7.0). */
function energySlidersToVoteAverageGte(filters: FilterState): number {
  const keys = ['pacing', 'intensity', 'cryMeter', 'humor', 'romance', 'suspense'] as const;
  let sum = 0;
  for (const k of keys) sum += filters[k];
  const avg = sum / keys.length;
  return 5 + (avg / 100) * 2;
}

/** Apply Discover quality floor from energy sliders (merged with Star Power / Top Rated floors). */
function applyEnergyVoteAverageFloor(discoverBase: DiscoverFetchParams, filters: FilterState): void {
  if (anyEnergySliderAt100(filters)) return;
  const floor = energySlidersToVoteAverageGte(filters);
  discoverBase.voteAverageGte = Math.max(discoverBase.voteAverageGte ?? 0, floor);
}

function mergeDiscoverRowsById(a: TmdbMovieResult[], b: TmdbMovieResult[]): TmdbMovieResult[] {
  const byId = new Map<number, TmdbMovieResult>();
  for (const m of a) byId.set(m.id, m);
  for (const m of b) byId.set(m.id, m);
  return Array.from(byId.values());
}

/**
 * Enrich every harvested row: `/movie/{id}` includes **append_to_response=keywords,videos** + credits (see `enrichMovie`).
 */
async function enrichDiscoverPool(apiKey: string, allMovies: TmdbMovieResult[]): Promise<Movie[]> {
  const cache = new Map<number, Movie>();
  const creditCountCache = new Map<number, number>();
  const enriched: Movie[] = [];
  for (let i = 0; i < allMovies.length; i += CONCURRENCY) {
    const batch = allMovies.slice(i, i + CONCURRENCY);
    const chunk = await Promise.all(
      batch.map(async (base) => {
        const hit = cache.get(base.id);
        if (hit) return hit;
        const movie = await enrichMovie(apiKey, base, { creditCountCache });
        cache.set(base.id, movie);
        return movie;
      })
    );
    enriched.push(...chunk);
  }
  return enriched;
}

/** Minimal stub for enrichMovie when we only have a TMDB movie ID. */
function stubResult(id: number): TmdbMovieResult {
  return {
    id,
    title: '',
    release_date: '',
    vote_average: 0,
    poster_path: null,
    overview: null,
    genre_ids: [],
  };
}

/** Parse TMDB numeric id from our movie id (e.g. "tmdb-872585" -> 872585). */
function tmdbIdFromMovieId(movieId: string): number {
  const n = parseInt(movieId.replace(/^tmdb-/, ''), 10);
  return Number.isNaN(n) ? 0 : n;
}

/** Fetch and enrich movies by TMDB IDs only; then keep only those in the allowed set. */
async function fetchAndEnrichByIds(
  apiKey: string,
  ids: number[],
  allowed: (id: number) => boolean,
  filters: FilterState
): Promise<Movie[]> {
  const rawResults: TmdbMovieResult[] = ids.map((id) => stubResult(id));
  const cache = new Map<number, Movie>();
  const creditCountCache = new Map<number, number>();
  const enrichOne = async (base: TmdbMovieResult): Promise<Movie> => {
    const cached = cache.get(base.id);
    if (cached) return cached;
    const movie = await enrichMovie(apiKey, base, { creditCountCache });
    cache.set(base.id, movie);
    return movie;
  };
  const enriched: Movie[] = [];
  for (let i = 0; i < rawResults.length; i += CONCURRENCY) {
    const batch = rawResults.slice(i, i + CONCURRENCY);
    const movies = await Promise.all(batch.map((b) => enrichOne(b)));
    enriched.push(...movies);
  }
  const filtered = enriched.filter((m) => allowed(tmdbIdFromMovieId(m.id)));
  const result = filterMovies(filtered, filters, { skipMaxSliderVibeTrim: true });
  // "List of record" mode: if Oscar filter is the only active preference, keep strict year order.
  // Otherwise keep full score-based order (1927–present VIP list; sliders sort locally, no pool cap).
  if (!hasSecondaryFilters(filters)) {
    result.sort((a, b) => {
      const yearDiff = (b.year ?? 0) - (a.year ?? 0);
      if (yearDiff !== 0) return yearDiff;
      return (b.oscarWinner ? 1 : 0) - (a.oscarWinner ? 1 : 0);
    });
    return result;
  }
  return result;
}

/** Live API: discover/movie with genres + runtime/decade; enrich → keyword-based vibe rank (no Discover keyword filter). */
export async function getTmdbMatches(
  apiKey: string,
  filters: FilterState,
  /** @deprecated Full Grid rule handles pagination; ignored. */
  _options?: GetTmdbMatchesOptions
): Promise<Movie[]> {
  const oscarFilter = String(filters.oscarFilter ?? 'any').toLowerCase();
  const isWinnerOnly = oscarFilter === 'winner';
  const isNomineeOnly = oscarFilter === 'nominee';
  const isBothOnly = oscarFilter === 'both';

  if (isWinnerOnly) {
    const ids = getOscarWinnerIds();
    return fetchAndEnrichByIds(apiKey, ids, isOscarWinnerId, filters);
  }

  if (isNomineeOnly) {
    const ids = getOscarNomineeIds();
    return fetchAndEnrichByIds(apiKey, ids, isOscarNomineeId, filters);
  }

  if (isBothOnly) {
    const ids = getOscarBothIds();
    return fetchAndEnrichByIds(apiKey, ids, isOscarListedId, filters);
  }

  const baseParams: {
    genre: FilterState['genre'];
    decade: FilterState['decade'];
    runtime: FilterState['runtime'];
    theme: FilterState['theme'];
    visualStyle: FilterState['visualStyle'];
    soundtrack: FilterState['soundtrack'];
    oscarFilter: FilterState['oscarFilter'];
    sortBy?:
      | 'vote_count.desc'
      | 'vote_average.desc'
      | 'popularity.desc'
      | 'primary_release_date.desc';
    voteCountGte?: number;
    voteCountLte?: number;
    popularityLte?: number;
    popularityGte?: number;
    voteAverageGte?: number;
    voteAverageLte?: number;
  } = {
    genre: filters.genre,
    decade: filters.decade,
    runtime: filters.runtime,
    theme: filters.theme,
    visualStyle: filters.visualStyle,
    soundtrack: filters.soundtrack,
    oscarFilter: filters.oscarFilter,
  };

  /**
   * Star Power → TMDB `/discover/movie` (no client-side cast filtering for the pool).
   * Low band: low popularity cap + minimum rating for hidden gems. High band: high minimum popularity for hits.
   */
  if (!filters.aListCastAny) {
    const c = filters.aListCast;
    if (c <= 10) {
      baseParams.popularityLte = 25;
      baseParams.voteAverageGte = 7.0;
      if (filters.criticsVsFans == null) baseParams.sortBy = 'vote_average.desc';
    } else if (c >= 90) {
      baseParams.popularityGte = 80;
      if (filters.criticsVsFans == null) {
        baseParams.sortBy = 'popularity.desc';
        baseParams.voteCountGte = Math.max(baseParams.voteCountGte ?? 0, 500);
      }
    } else if (filters.criticsVsFans == null) {
      baseParams.sortBy = 'popularity.desc';
      baseParams.voteCountGte = Math.max(baseParams.voteCountGte ?? 0, 500);
    }
  }

  /**
   * Critics vs Fans: sort + vote floors. **Top Rated** (`both`) always uses `vote_average.desc` and
   * `vote_count.gte=500` so one-off 10★ votes don’t dominate.
   */
  if (filters.criticsVsFans != null) {
    if (filters.criticsVsFans === 'critics') {
      baseParams.sortBy = 'vote_average.desc';
      baseParams.voteCountGte = Math.max(baseParams.voteCountGte ?? 0, 500);
      delete baseParams.voteCountLte;
    } else if (filters.criticsVsFans === 'fans') {
      baseParams.sortBy = 'vote_count.desc';
      baseParams.voteCountGte = Math.max(baseParams.voteCountGte ?? 0, 500);
      delete baseParams.voteCountLte;
    } else if (filters.criticsVsFans === 'both') {
      baseParams.sortBy = 'vote_average.desc';
      baseParams.voteCountGte = Math.max(baseParams.voteCountGte ?? 0, 500);
      delete baseParams.voteCountLte;
    }
  }

  let genreJoinMode: 'and' | 'or' = 'and';
  const filterMoviesOpts: FilterMoviesOptions = {};

  const smartHarvest = buildSmartHarvestAugmentation(filters);
  if (process.env.NODE_ENV === 'development') {
    console.log('[Cinematch] Smart Harvest', smartHarvest);
  }

  const discoverBase: DiscoverFetchParams = {
    genre: baseParams.genre,
    decade: baseParams.decade,
    runtime: baseParams.runtime,
    theme: baseParams.theme,
    visualStyle: baseParams.visualStyle,
    soundtrack: baseParams.soundtrack,
    oscarFilter: baseParams.oscarFilter,
    smartHarvest,
    sortBy: baseParams.sortBy,
    voteCountGte: baseParams.voteCountGte,
    voteCountLte: baseParams.voteCountLte,
    popularityLte: baseParams.popularityLte,
    popularityGte: baseParams.popularityGte,
    voteAverageGte: baseParams.voteAverageGte,
    voteAverageLte: baseParams.voteAverageLte,
  };

  /** Max-slider intent: surface popular titles that fit the vibe (overrides Star Power discover caps). */
  if (anyEnergySliderAt100(filters)) {
    discoverBase.sortBy = 'popularity.desc';
    delete discoverBase.voteCountLte;
    delete discoverBase.popularityLte;
    delete discoverBase.popularityGte;
    delete discoverBase.voteAverageGte;
  } else {
    /** Pacing / energy sliders → `vote_average.gte` (refines Discover against the full DB). */
    applyEnergyVoteAverageFloor(discoverBase, filters);
  }

  // --- (1) Deep search: 5 parallel Discover calls (pages 1–5) → ≤100 unique TMDB rows ---
  let allMovies: TmdbMovieResult[];
  if (filters.genre.length >= 2) {
    allMovies = await harvestDiscoverDeepPages(apiKey, discoverBase, 'and');
    if (allMovies.length < GENRE_FALLBACK_MIN_RESULTS) {
      genreJoinMode = 'or';
      filterMoviesOpts.genreFilterMode = 'any';
      allMovies = await harvestDiscoverDeepPages(apiKey, discoverBase, 'or');
    }
  } else {
    allMovies = await harvestDiscoverDeepPages(apiKey, discoverBase, 'and');
  }

  /** Re-fetch without UI genres so `with_genres` is slider-only OR (wider pool when user AND-ed many genres). */
  if (
    allMovies.length < SLIDER_100_GENRE_BACKUP_MIN_UNIQUE &&
    anyEnergySliderAt100(filters) &&
    filters.genre.length > 0
  ) {
    const backupBase: DiscoverFetchParams = {
      ...discoverBase,
      genre: [],
      sortBy: 'popularity.desc',
    };
    delete backupBase.voteCountLte;
    delete backupBase.popularityLte;
    delete backupBase.popularityGte;
    delete backupBase.voteAverageGte;
    const extraRows = await harvestDiscoverDeepPages(apiKey, backupBase, 'and');
    allMovies = mergeDiscoverRowsById(allMovies, extraRows);
    const pipe = discoverBase.smartHarvest?.withGenresSlider100Pipe;
    console.log(
      '[Cinematch] Slider-100 genre backup harvest: merged',
      extraRows.length,
      'rows (slider with_genres pipe:',
      pipe ?? discoverBase.smartHarvest?.withGenresOr ?? 'keywords-only',
      ')'
    );
  }

  if (filters.cultClassic === true) {
    const cultRows = await harvestDiscoverDeepPages(
      apiKey,
      { ...discoverBase, sortBy: 'vote_average.desc' },
      genreJoinMode
    );
    allMovies = mergeDiscoverRowsById(allMovies, cultRows);
  }

  allMovies = dedupeDiscoverRows(allMovies).slice(0, DEEP_POOL_MAX);

  // --- (2) Enrich the capped pool only (≤100): movie/{id}?append_to_response=keywords,videos + credits ---
  const enrichedPool = await enrichDiscoverPool(apiKey, allMovies);

  // --- (3) Taste/vibe filter + local **Top Rated** sort (critic + audience blend) → ≤100 for client cache ---
  const ranked = filterMovies(enrichedPool, filters, filterMoviesOpts);
  const topRatedSorted = [...ranked].sort(
    (a, b) => combinedTopRatedMatchScore(b) - combinedTopRatedMatchScore(a)
  );
  const pool = topRatedSorted.slice(0, DEEP_POOL_MAX);
  for (const m of pool) {
    const tr = combinedTopRatedMatchScore(m);
    m.matchPercentage = Math.round(tr);
    m.finalMatchScore = tr;
  }
  console.log('Total Movies Returned (100-movie Top Rated pool):', pool.length);
  return pool;
}
