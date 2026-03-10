/**
 * TMDB enrichment: details, keywords, credits → full Movie with real data.
 * Derives pacing, humor, romance, etc. from genre + keywords when TMDB has no direct field.
 */

import type { Movie, Genre, Theme, VisualStyle, Soundtrack, CriticsVsFans } from './types';
import type { FilterState } from './types';
import type { TmdbMovieResult, TmdbDiscoverResponse } from './tmdb';
import { GENRE_ID_TO_NAME, buildDiscoverSearchParams } from './tmdb';
import { isOscarBestPictureWinner, isOscarBestPictureNominee } from './oscarWinners';
import { filterMovies } from './filterMovies';

const TMDB_BASE = 'https://api.themoviedb.org/3';
/** Fetch this many pages (20 per page) to get a pool for ranking; e.g. 3 = 60 movies. */
const DISCOVER_PAGES = 3;
const CONCURRENCY = 6;

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
}

export interface TmdbKeywordsResponse {
  keywords: { id: number; name: string }[];
}

export interface TmdbCreditsResponse {
  crew: { id: number; name: string; job: string; popularity: number }[];
  cast: { id: number; name: string; popularity: number; order: number }[];
}

export interface TmdbPersonResponse {
  id: number;
  name: string;
  popularity: number;
}

async function fetchTmdb<T>(apiKey: string, path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${TMDB_BASE}${path}${path.includes('?') ? '&' : '?'}api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${path}`);
  return res.json();
}

/**
 * Scale TMDB person popularity (often 0.5–50 for directors) to our 0–100 director prominence.
 * Uses log2 so small differences among obscure directors don't dominate; multiplier 15
 * spreads "known" directors (pop ~5–20) into the 45–80 range so the prominence slider
 * meaningfully ranks results without needing blockbuster-level popularity.
 */
function scalePopularity(pop: number): number {
  if (pop <= 0) return 0;
  return Math.min(100, Math.round(Math.log2(pop + 1) * 15));
}

const A_LIST_POPULARITY_THRESHOLD = 50;

/** Star power from top 5 billed cast: A-List = popularity > 50. Returns 0, 30, or 100. */
function starPowerScoreFromCast(cast: TmdbCreditsResponse['cast']): number {
  if (!cast?.length) return 0;
  const byOrder = [...cast].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  const top5 = byOrder.slice(0, 5);
  const aListCount = top5.filter((c) => (c.popularity ?? 0) > A_LIST_POPULARITY_THRESHOLD).length;
  if (aListCount >= 3) return 100;
  if (aListCount >= 1) return 30;
  return 0;
}

/** Legacy: hasAListCast true when star power is 30 or 100 (1+ A-List in top 5). */
function hasAListCast(cast: TmdbCreditsResponse['cast']): boolean {
  return starPowerScoreFromCast(cast) >= 30;
}

/** vote_average high + revenue not dominant → critics; high popularity → fans. */
function criticsVsFans(voteAverage: number, voteCount: number): CriticsVsFans {
  if (voteCount >= 5000 && voteAverage >= 7.8) return 'critics';
  if (voteCount >= 10000) return 'fans';
  return 'both';
}

export async function fetchMovieDetails(apiKey: string, movieId: number): Promise<TmdbMovieDetails | null> {
  try {
    return await fetchTmdb<TmdbMovieDetails>(apiKey, `/movie/${movieId}`);
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

export async function fetchPerson(apiKey: string, personId: number): Promise<TmdbPersonResponse | null> {
  try {
    return await fetchTmdb<TmdbPersonResponse>(apiKey, `/person/${personId}`);
  } catch {
    return null;
  }
}

export async function enrichMovie(apiKey: string, base: TmdbMovieResult): Promise<Movie> {
  const [details, keywordNames, credits] = await Promise.all([
    fetchMovieDetails(apiKey, base.id),
    fetchMovieKeywords(apiKey, base.id),
    fetchMovieCredits(apiKey, base.id),
  ]);

  const genreIds = details?.genre_ids ?? base.genre_ids ?? [];
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

  let directorProminence = 0;
  const director = credits?.crew?.find((c) => c.job === 'Director');
  if (director?.id) {
    const person = await fetchPerson(apiKey, director.id);
    if (person?.popularity != null) directorProminence = scalePopularity(person.popularity);
  }

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
    theme: themes,
    visualStyle: visualStyles,
    soundtrack: soundtracks,
    boxOffice: revenue,
    budget,
    rating: voteAverage,
    hasAListCast: credits ? hasAListCast(credits.cast) : false,
    starPowerScore: credits ? starPowerScoreFromCast(credits.cast) : 0,
    criticsVsFans: criticsVsFans(voteAverage, voteCount),
    oscarWinner: isOscarBestPictureWinner(base.id),
    oscarNominee: isOscarBestPictureNominee(base.id),
    runtimeMinutes: details?.runtime ?? 0,
    directorProminence,
    popularity,
    voteCount,
    imdbId: details?.imdb_id ?? undefined,
  };
}

async function fetchDiscoverPage(
  apiKey: string,
  params: {
    genre: FilterState['genre'];
    decade: FilterState['decade'];
    runtime: FilterState['runtime'];
    theme: FilterState['theme'];
    visualStyle: FilterState['visualStyle'];
    soundtrack: FilterState['soundtrack'];
    oscarFilter: FilterState['oscarFilter'];
    sortBy?: 'vote_count.desc' | 'vote_average.desc' | 'popularity.desc';
    voteCountGte?: number;
    voteCountLte?: number;
    popularityLte?: number;
  },
  page: number
): Promise<TmdbMovieResult[]> {
  const q = buildDiscoverSearchParams({
    genre: params.genre?.length ? params.genre : undefined,
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
  });
  const url = `${TMDB_BASE}/discover/movie?${new URLSearchParams({ ...q, api_key: apiKey }).toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB Discover ${res.status}`);
  const data = (await res.json()) as TmdbDiscoverResponse;
  return data.results ?? [];
}

/** Minimum 2 pages (40 movies) for ranking pool. */
const DISCOVER_PAGES_MIN = 2;
const DISCOVER_PAGES_CULT = 5;

/** Options for discover (e.g. random start page for variety). */
export type GetTmdbMatchesOptions = { discoverStartPage?: number };

/** Live API: discover/movie with with_genres + with_keywords from user, then enrich and rank. */
export async function getTmdbMatches(apiKey: string, filters: FilterState, options?: GetTmdbMatchesOptions): Promise<Movie[]> {
  const baseParams: {
    genre: FilterState['genre'];
    decade: FilterState['decade'];
    runtime: FilterState['runtime'];
    theme: FilterState['theme'];
    visualStyle: FilterState['visualStyle'];
    soundtrack: FilterState['soundtrack'];
    oscarFilter: FilterState['oscarFilter'];
    sortBy?: 'vote_count.desc' | 'vote_average.desc' | 'popularity.desc';
    voteCountGte?: number;
    voteCountLte?: number;
    popularityLte?: number;
  } = {
    genre: filters.genre,
    decade: filters.decade,
    runtime: filters.runtime,
    theme: filters.theme,
    visualStyle: filters.visualStyle,
    soundtrack: filters.soundtrack,
    oscarFilter: filters.oscarFilter,
  };

  if (!filters.directorProminenceAny) {
    const dp = filters.directorProminence;
    if (dp < 30) {
      baseParams.voteCountLte = 1000;
      baseParams.popularityLte = 20;
    } else if (dp > 70) {
      baseParams.voteCountGte = 2000;
    }
  }

  if (!filters.aListCastAny && filters.aListCast >= 50) {
    baseParams.sortBy = 'popularity.desc';
    if (baseParams.voteCountGte == null) baseParams.voteCountGte = 500;
  }

  const rawById = new Map<number, TmdbMovieResult>();
  const pagesToFetch = filters.cultClassic === true ? DISCOVER_PAGES_CULT : Math.max(DISCOVER_PAGES_MIN, 3);
  const startPage = options?.discoverStartPage != null
    ? Math.max(1, Math.min(10, Math.floor(options.discoverStartPage)))
    : 1;

  for (let i = 0; i < pagesToFetch; i++) {
    const pageNum = startPage + i;
    const page = await fetchDiscoverPage(apiKey, baseParams, pageNum);
    for (const m of page) rawById.set(m.id, m);
  }

  if (filters.cultClassic === true) {
    for (let i = 0; i < pagesToFetch; i++) {
      const pageNum = startPage + i;
      const page = await fetchDiscoverPage(apiKey, { ...baseParams, sortBy: 'vote_average.desc' }, pageNum);
      for (const m of page) rawById.set(m.id, m);
    }
  }

  const rawResults = Array.from(rawById.values());

  const cache = new Map<number, Movie>();
  const enrichOne = async (base: TmdbMovieResult): Promise<Movie> => {
    const cached = cache.get(base.id);
    if (cached) return cached;
    const movie = await enrichMovie(apiKey, base);
    cache.set(base.id, movie);
    return movie;
  };

  const enriched: Movie[] = [];
  for (let i = 0; i < rawResults.length; i += CONCURRENCY) {
    const batch = rawResults.slice(i, i + CONCURRENCY);
    const movies = await Promise.all(batch.map((b) => enrichOne(b)));
    enriched.push(...movies);
  }

  return filterMovies(enriched, filters);
}
