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
const DISCOVER_PAGES = 5;
const CONCURRENCY = 6;

/** Keyword name (lowercase) → our Theme tags (partial match). */
function keywordToThemes(name: string): Theme[] {
  const themes: Theme[] = [];
  const n = name.toLowerCase();
  const themeMap: [string, Theme][] = [
    ['coming of age', 'Coming of Age'], ['revenge', 'Revenge'], ['heist', 'Heist'],
    ['dystopia', 'Dystopia'], ['time travel', 'Time Travel'], ['road trip', 'Road Trip'],
    ['based on true story', 'Based on True Story'], ['twist ending', 'Twist Ending'],
    ['dysfunctional family', 'Dysfunctional Family'], ['fish out of water', 'Fish out of Water'],
    ['against the clock', 'Against the Clock'], ['noir', 'Noir'], ['love triangle', 'Love Triangle'],
    ['quest', 'Quest'], ['survival', 'Survival'], ['identity', 'Identity Crisis'],
    ['redemption', 'Redemption'], ['escape', 'Escape'], ['betrayal', 'Betrayal'],
    ['found family', 'Found Family'], ['multiverse', 'Multiverse'], ['murder', 'Murder'],
    ['detective', 'Detective'], ['conspiracy', 'Conspiracy'], ['secret identity', 'Secret Identity'],
    ['alien', 'Alien'], ['robot', 'Robot'], ['superhero', 'Superhero'], ['vampire', 'Vampire'],
    ['zombie', 'Zombie'], ['ghost', 'Ghost'], ['witch', 'Witch'], ['prison', 'Prison'],
    ['school', 'School'], ['wedding', 'Wedding'], ['christmas', 'Christmas'], ['sport', 'Sports'],
    ['music', 'Music'], ['dance', 'Dance'], ['art', 'Art'], ['politic', 'Politics'], ['war', 'War'],
    ['terrorism', 'Terrorism'], ['kidnapping', 'Kidnapping'], ['hostage', 'Hostage'],
    ['bank robbery', 'Bank Robbery'], ['assassin', 'Assassin'], ['spy', 'Spy'],
    ['double cross', 'Double Cross'], ['corruption', 'Corruption'], ['courtroom', 'Courtroom'],
    ['mistaken identity', 'Mistaken Identity'], ['amnesia', 'Amnesia'], ['serial killer', 'Serial Killer'],
    ['haunted house', 'Haunted House'], ['apocalypse', 'Apocalypse'], ['space', 'Space'],
    ['underdog', 'Underdog'], ['rivalry', 'Rivalry'], ['friendship', 'Friendship'],
    ['loss', 'Loss'], ['grief', 'Grief'], ['addiction', 'Addiction'], ['mental', 'Mental Illness'],
  ];
  for (const [key, theme] of themeMap) {
    if (n.includes(key)) themes.push(theme);
  }
  return themes;
}

/** Keyword name → our VisualStyle tags. */
function keywordToVisualStyles(name: string): VisualStyle[] {
  const styles: VisualStyle[] = [];
  const n = name.toLowerCase();
  const styleMap: [string, VisualStyle][] = [
    ['noir', 'Film Noir'], ['vibrant', 'Vibrant'], ['gritty', 'Gritty'], ['symmetric', 'Symmetric'],
    ['documentary', 'Documentary-style'], ['period', 'Period'], ['contrast', 'High Contrast'],
    ['vintage', 'Vintage'], ['black and white', 'Black and White'], ['handheld', 'Handheld'],
    ['animated', 'Animated'], ['stop motion', 'Stop Motion'], ['minimalist', 'Minimalist'],
    ['surreal', 'Surreal'], ['road movie', 'Road Movie'], ['single location', 'Single Location'],
    ['neon', 'Neon-lit'], ['desaturated', 'Desaturated'], ['warm', 'Warm Tones'],
    ['cold', 'Cold Tones'], ['one take', 'One Take'], ['found footage', 'Found Footage'],
  ];
  for (const [key, style] of styleMap) {
    if (n.includes(key)) styles.push(style);
  }
  return styles;
}

/** Keyword name → our Soundtrack tags. */
function keywordToSoundtracks(name: string): Soundtrack[] {
  const tracks: Soundtrack[] = [];
  const n = name.toLowerCase();
  const trackMap: [string, Soundtrack][] = [
    ['orchestral', 'Orchestral'], ['jazz', 'Jazz'], ['electronic', 'Electronic'],
    ['minimal', 'Minimal'], ['rock', 'Rock & Guitar'], ['hip-hop', 'Hip-Hop & R&B'],
    ['classical', 'Classical'], ['score', 'Iconic Score'], ['musical', 'Musical Numbers'],
    ['ambient', 'Ambient'], ['folk', 'Folk & Americana'], ['country', 'Country'],
    ['blues', 'Blues'], ['synth', 'Synth'], ['piano', 'Piano-led'], ['choir', 'Choir & Strings'],
    ['latin', 'Latin'], ['world music', 'World Music'], ['opera', 'Opera'], ['acoustic', 'Acoustic'],
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

/** Top-billed cast with solid popularity → hasAListCast (recognizable names, not just megastars). */
function hasAListCast(cast: TmdbCreditsResponse['cast']): boolean {
  if (!cast?.length) return false;
  const top = cast.slice(0, 5);
  const avgPop = top.reduce((s, c) => s + (c.popularity ?? 0), 0) / top.length;
  return avgPop >= 6;
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
    criticsVsFans: criticsVsFans(voteAverage, voteCount),
    oscarWinner: isOscarBestPictureWinner(base.id),
    oscarNominee: isOscarBestPictureNominee(base.id),
    runtimeMinutes: details?.runtime ?? 0,
    directorProminence,
    popularity,
    voteCount,
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
    sortBy?: 'vote_count.desc' | 'vote_average.desc';
  },
  page: number
): Promise<TmdbMovieResult[]> {
  const q = buildDiscoverSearchParams({
    genre: params.genre?.length ? params.genre : undefined,
    decade: params.decade?.length ? params.decade.filter((d): d is NonNullable<typeof d> => d != null) : undefined,
    runtime: params.runtime ?? null,
    theme: params.theme?.length ? params.theme : undefined,
    visualStyle: params.visualStyle?.length ? params.visualStyle : undefined,
    page,
    sortBy: params.sortBy,
  });
  const url = `${TMDB_BASE}/discover/movie?${new URLSearchParams({ ...q, api_key: apiKey }).toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB Discover ${res.status}`);
  const data = (await res.json()) as TmdbDiscoverResponse;
  return data.results ?? [];
}

const DISCOVER_PAGES_CULT = 5; // pages per sort when cult classic selected (we fetch both vote_count and vote_average)

/** Run discover (multiple pages), enrich each movie, then filter and sort with full wizard filters. */
export async function getTmdbMatches(apiKey: string, filters: FilterState): Promise<Movie[]> {
  const baseParams = {
    genre: filters.genre,
    decade: filters.decade,
    runtime: filters.runtime,
    theme: filters.theme,
    visualStyle: filters.visualStyle,
  };

  const rawById = new Map<number, TmdbMovieResult>();
  const pagesToFetch = filters.cultClassic === true ? DISCOVER_PAGES_CULT : DISCOVER_PAGES;

  for (let p = 1; p <= pagesToFetch; p++) {
    const page = await fetchDiscoverPage(apiKey, baseParams, p);
    for (const m of page) rawById.set(m.id, m);
  }

  if (filters.cultClassic === true) {
    for (let p = 1; p <= pagesToFetch; p++) {
      const page = await fetchDiscoverPage(apiKey, { ...baseParams, sortBy: 'vote_average.desc' }, p);
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
