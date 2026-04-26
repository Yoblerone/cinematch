/**
 * TMDB enrichment: details, keywords, credits → full Movie with real data.
 * Derives pacing, humor, romance, etc. from genre + keywords when TMDB has no direct field.
 */

import type { Movie, Genre, Theme, VisualStyle, Soundtrack, CriticsVsFans } from './types';
import type { FilterState } from './types';
import type { TmdbMovieResult, TmdbDiscoverResponse } from './tmdb';
import { GENRE_ID_TO_NAME, GENRE_NAME_TO_ID, buildDiscoverSearchParams, type SmartHarvestQuerySlice } from './tmdb';
import { ENERGY_MANIFEST, type EnergyManifestAxis } from './scoring/energyManifest';
import { scoreMovieDeclarative } from './scoring/thematicEngine';
import {
  FILTER_WEIGHT_HIGH,
  FILTER_WEIGHT_LOW,
  nearestFilterWeightStop,
} from './filterWeightSegments';
import { anyEmotionSliderAbove70, emptySmartHarvestSlice } from './smartHarvest';
import {
  getOscarWinnerIds,
  getOscarNomineeIds,
  getOscarBothIds,
  isOscarWinnerId,
  isOscarNomineeId,
  isOscarListedId,
  getOscarAwardInfo,
} from './data/oscar-truth';
import { filterMovies } from './filterMovies';
import { claudeRerank } from './claudeRerank';
import { combinedTopRatedMatchScore } from './criticsFansRank';
import { PROMINENCE_TRUTH_LIST } from './prominence';
import { prestigeCastMatch, prestigeDirectorMatch } from './prestigeScore';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const CONCURRENCY = 6;

const ENGINE_AXES: EnergyManifestAxis[] = [
  'narrative_pacing',
  'emotional_tone',
  'brain_power',
  'visual_style',
  'suspense_level',
  'world_style',
];

const AXES = [
  'narrative_pacing',
  'emotional_tone',
  'brain_power',
  'visual_style',
  'suspense_level',
  'world_style',
] as const;

function activeSeedAxes(filters: FilterState): EnergyManifestAxis[] {
  return ENGINE_AXES.filter((axis) => (filters[axis] ?? 50) > 70);
}

/**
 * Extra TMDB keyword IDs per axis (curated “adjacent” signals) merged into `with_keywords`
 * so high-intent discovers are stricter and less dominated by a single id.
 */
const VIBE_HIGH_RELATED_KEYWORD_IDS: Record<EnergyManifestAxis, readonly number[]> = {
  narrative_pacing: [9748, 3713, 234505],
  emotional_tone: [9840, 10065, 10614],
  brain_power: [10683, 185014, 9672],
  visual_style: [2590, 9683, 9807],
  suspense_level: [185014, 12565, 9663],
  world_style: [345821, 181182, 2791],
};

/** High-tier Discover keywords using comma for logical intersection (AND). */
function buildSliderSeedKeywordCsv(filters: FilterState): string | undefined {
  const ids = new Set<number>();
  const axes = activeSeedAxes(filters);
  for (const axis of axes) {
    for (const id of ENERGY_MANIFEST[axis].high.tmdb_keyword_ids) ids.add(id);
    for (const id of VIBE_HIGH_RELATED_KEYWORD_IDS[axis]) ids.add(id);
  }
  if (ids.size === 0) return undefined;
  return Array.from(ids).join(',');
}

/** Low-tier Discover exclusions use comma for logical intersection (AND). */
function buildLowSeedKeywordCsv(filters: FilterState): string | undefined {
  const ids = new Set<number>();
  for (const axis of ENGINE_AXES) {
    if (filters[axis] == null) continue;
    if (filters[axis] < 30) {
      for (const id of ENERGY_MANIFEST[axis].low.tmdb_keyword_ids) ids.add(id);
    }
  }
  if (ids.size === 0) return undefined;
  return Array.from(ids).join(',');
}

/** Medium on an axis excludes both low/high keyword clusters for that axis. */
function buildMediumExclusionKeywordCsv(filters: FilterState): string | undefined {
  const ids = new Set<number>();
  for (const axis of ENGINE_AXES) {
    const raw = filters[axis];
    if (raw == null) continue;
    if (nearestFilterWeightStop(raw) !== 50) continue;
    for (const id of ENERGY_MANIFEST[axis].low.tmdb_keyword_ids) ids.add(id);
    for (const id of ENERGY_MANIFEST[axis].high.tmdb_keyword_ids) ids.add(id);
  }
  if (ids.size === 0) return undefined;
  /** Comma = TMDB AND on `without_keywords` — every listed id participates in the exclusion rule. */
  return Array.from(ids)
    .filter((n) => Number.isFinite(n))
    .join(',');
}

/** Normalize any keyword CSV to comma-separated unique numeric ids (stable order). */
function commaKeywordCsvUnique(csv: string | undefined): string | undefined {
  if (!csv?.trim()) return undefined;
  const ids = new Set<number>();
  for (const raw of csv.split(/[|,]/)) {
    const t = raw.trim();
    if (!/^\d+$/.test(t)) continue;
    ids.add(Number(t));
  }
  if (ids.size === 0) return undefined;
  return Array.from(ids).join(',');
}

function hasSecondaryFilters(filters: FilterState): boolean {
  if (filters.crowd != null) return true;
  if (filters.genre.length > 0) return true;
  if (filters.aListCast != null) return true;
  if (filters.criticsVsFans != null) return true;
  if (filters.decade.length > 0) return true;
  if (filters.runtime != null) return true;
  if (filters.directorProminence != null) return true;
  if (filters.narrative_pacing != null && filters.narrative_pacing !== 50) return true;
  if (filters.emotional_tone != null && filters.emotional_tone !== 50) return true;
  if (filters.brain_power != null && filters.brain_power !== 50) return true;
  if (filters.visual_style != null && filters.visual_style !== 50) return true;
  if (filters.suspense_level != null && filters.suspense_level !== 50) return true;
  if (filters.world_style != null && filters.world_style !== 50) return true;
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
): {
  narrative_pacing: number;
  emotional_tone: number;
  brain_power: number;
  visual_style: number;
  suspense_level: number;
  world_style: number;
} {
  let narrative_pacing = 50;
  let emotional_tone = 50;
  let brain_power = 50;
  let visual_style = 50;
  let suspense_level = 50;
  let world_style = 50;
  const kw = keywordNames.join(' ').toLowerCase();

  if (genreIds.includes(28) || genreIds.includes(12)) narrative_pacing += 18;
  if (genreIds.includes(18) || genreIds.includes(10749)) emotional_tone += 18;
  if (genreIds.includes(9648) || genreIds.includes(878)) brain_power += 16;
  if (genreIds.includes(12) || genreIds.includes(14) || genreIds.includes(878)) visual_style += 18;
  if (genreIds.includes(53) || genreIds.includes(27)) suspense_level += 22;
  if (genreIds.includes(18) || genreIds.includes(99)) world_style += 12;

  if (kw.includes('slow') || kw.includes('meditative')) narrative_pacing -= 20;
  if (kw.includes('fast') || kw.includes('kinetic')) narrative_pacing += 16;
  if (kw.includes('grief') || kw.includes('loss') || kw.includes('tragedy')) emotional_tone += 20;
  if (kw.includes('philosoph') || kw.includes('mind') || kw.includes('existential')) brain_power += 18;
  if (kw.includes('epic') || kw.includes('spectacle')) visual_style += 18;
  if (kw.includes('suspense') || kw.includes('thriller')) suspense_level += 20;
  if (kw.includes('surreal') || kw.includes('fantasy') || kw.includes('dream')) world_style -= 18;
  if (kw.includes('realism') || kw.includes('true story')) world_style += 20;

  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
  return {
    narrative_pacing: clamp(narrative_pacing),
    emotional_tone: clamp(emotional_tone),
    brain_power: clamp(brain_power),
    visual_style: clamp(visual_style),
    suspense_level: clamp(suspense_level),
    world_style: clamp(world_style),
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
  const top3Cast = castSorted.slice(0, 3);
  const castLeadFilmographyCounts = await Promise.all(
    top3Cast.map((c) => fetchPersonFilmographyUniqueCount(apiKey, c.id, creditCountCache))
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
    top3Cast.some((c) => aListActorIds.has(c.id)) || castLeadFilmographyCounts.some((n) => n >= 20);

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
    castCredits: castSorted.slice(0, 3).map((c) => ({
      id: c.id,
      name: c.name,
      popularity: c.popularity ?? 0,
      order: c.order,
    })),
    castLeadFilmographyCounts,
    directorFilmographyCount,
    crewCredits: crewCreditsMapped,
  } as Movie;

  const directorProminence = Math.round(prestigeDirectorMatch(prestigePartial, 100, PROMINENCE_TRUTH_LIST));

  const voteAverage = details?.vote_average ?? base.vote_average ?? 0;
  const voteCount = details?.vote_count ?? (base as unknown as { vote_count?: number }).vote_count ?? 0;
  const revenue = details?.revenue ?? 0;
  const budget = details?.budget ?? 0;
  const year = details?.release_date ? new Date(details.release_date).getFullYear() : (base.release_date ? new Date(base.release_date).getFullYear() : 0);
  const popularity = details?.popularity ?? (base as unknown as { popularity?: number }).popularity ?? 0;

  const posterPath = details?.poster_path ?? base.poster_path ?? null;

  const overviewFull = typeof details?.overview === 'string' ? details.overview.trim() : '';

  return {
    id: `tmdb-${base.id}`,
    title: details?.title ?? base.title,
    year,
    overview: overviewFull || undefined,
    tagline: details?.tagline?.trim() || overviewFull.slice(0, 100) || '',
    posterColor: 'from-slate-800 to-amber-900',
    posterPath: posterPath ?? undefined,
    crowd: [],
    narrative_pacing: sliders.narrative_pacing,
    emotional_tone: sliders.emotional_tone,
    brain_power: sliders.brain_power,
    visual_style: sliders.visual_style,
    suspense_level: sliders.suspense_level,
    world_style: sliders.world_style,
    pacing: sliders.narrative_pacing,
    cryMeter: sliders.emotional_tone,
    humor: sliders.brain_power,
    romance: sliders.visual_style,
    suspense: sliders.suspense_level,
    intensity: sliders.world_style,
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
  oscarFilter: FilterState['oscarFilter'];
  /** Energy sliders → Discover keyword / genre augmentation (non–Academy paths only). */
  smartHarvest?: SmartHarvestQuerySlice;
  sortBy?:
    | 'vote_count.desc'
    | 'vote_count.asc'
    | 'vote_average.desc'
    | 'popularity.desc'
    | 'popularity.asc'
    | 'revenue.desc'
    | 'primary_release_date.desc'
    | 'primary_release_date.asc';
  voteCountGte?: number;
  voteCountLte?: number;
  popularityLte?: number;
  popularityGte?: number;
  voteAverageGte?: number;
  voteAverageLte?: number;
  /** Freshness floor for Discover results (YYYY-MM-DD). */
  primaryReleaseDateGte?: string;
  /** Optional Discover keyword seed (used by non-pacing harvest flows). */
  withKeywordsCsv?: string;
  /** `with_keywords` join mode: comma AND (default) or pipe OR for soft vibe filters. */
  withKeywordsJoinMode?: 'and' | 'or';
  /** Raw comma-separated TMDB keyword IDs for Discover `without_keywords` (comma AND semantics). */
  withoutKeywordsCsv?: string;
  genreJoinMode?: 'and' | 'or';
};

const PACING_FAST_KEYWORDS = [
  'ticking clock',
  'suspense',
  'thriller',
  'chase',
  'action',
  'adventure',
  'racing',
  'violence',
  'gunfight',
  'urgent',
  'momentum',
  'fast-paced',
  'high stakes',
  'intense',
  'anxiety',
  'crime spree',
  'non-stop action',
  'heist',
  'chaotic',
  'survival',
  'escape',
  'breathless',
  'adrenaline',
  'manhunt',
  'double cross',
  'rescue mission',
  'explosive',
] as const;

const PACING_SLOW_KEYWORDS = [
  'meditative',
  'slow burn',
  'atmospheric',
  'character study',
  'philosophical',
  'long take',
  'minimalist',
  'existential',
  'slice of life',
  'observational',
  'pastoral',
  'poetic cinema',
  'quiet',
  'melancholic',
  'intimate',
  'slow-paced',
  'psychological drama',
] as const;
type ActivePacingMode = 'fast' | 'slow' | null;

function activePacingMode(filters: FilterState): ActivePacingMode {
  const next = filters.narrative_pacing;
  const legacy = filters.pacing;
  if (next == null && legacy == null) return null;
  const nextStop = next == null ? null : nearestFilterWeightStop(next);
  const legacyStop = legacy == null ? null : nearestFilterWeightStop(legacy);
  // Guard against stale mixed state (e.g. one says fast, the other says slow): fall back to baseline.
  if (
    nextStop != null &&
    legacyStop != null &&
    ((nextStop === FILTER_WEIGHT_HIGH && legacyStop === FILTER_WEIGHT_LOW) ||
      (nextStop === FILTER_WEIGHT_LOW && legacyStop === FILTER_WEIGHT_HIGH))
  ) {
    return null;
  }
  const stop = nextStop ?? legacyStop;
  if (stop === FILTER_WEIGHT_HIGH) return 'fast';
  if (stop === FILTER_WEIGHT_LOW) return 'slow';
  return null;
}

function joinKeywordCsv(raw: string, mode: 'and' | 'or'): string {
  const cleaned = raw
    .split(/[|,]/)
    .map((x) => x.trim())
    .filter((x) => /^\d+$/.test(x));
  return mode === 'or' ? cleaned.join('|') : cleaned.join(',');
}

function normalizePacingText(s: string): string {
  return s.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function countPacingKeywordHits(haystack: string, bucket: readonly string[]): number {
  let hits = 0;
  for (const term of bucket) {
    const needle = normalizePacingText(term);
    if (!needle) continue;
    if (haystack.includes(needle)) hits += 1;
  }
  return hits;
}

function countPacingHits(movie: Movie, pacing: Exclude<ActivePacingMode, null>): number {
  const text = normalizePacingText(
    [movie.overview ?? '', movie.tagline ?? '', ...(movie.keywordNames ?? [])].join(' ')
  );
  if (pacing === 'fast') return countPacingKeywordHits(text, PACING_FAST_KEYWORDS);
  return countPacingKeywordHits(text, PACING_SLOW_KEYWORDS);
}

function stripAnimationFromWithoutGenres(smartHarvest: SmartHarvestQuerySlice | undefined): SmartHarvestQuerySlice | undefined {
  if (!smartHarvest) return smartHarvest;
  if (!smartHarvest.withoutGenres) return smartHarvest;
  const keep = smartHarvest.withoutGenres
    .split(',')
    .map((x) => x.trim())
    .filter((x) => /^\d+$/.test(x) && x !== '16');
  return { ...smartHarvest, withoutGenres: keep.length > 0 ? keep.join(',') : undefined };
}

function calculatePedigreeScore(movie: Movie, filters: FilterState): number {
  if (filters.oscarFilter == null) return 0;
  if (filters.oscarFilter === 'winner') return movie.oscarWinner ? 20 : 0;
  if (filters.oscarFilter === 'nominee') return movie.oscarNominee ? 20 : 0;
  return movie.oscarWinner || movie.oscarNominee ? 20 : 0;
}

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
    oscarFilter: params.oscarFilter ?? undefined,
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
  if (params.primaryReleaseDateGte) q['primary_release_date.gte'] = params.primaryReleaseDateGte;
  if (params.withKeywordsCsv) {
    q.with_keywords = joinKeywordCsv(params.withKeywordsCsv, params.withKeywordsJoinMode ?? 'and');
  }
  if (params.withoutKeywordsCsv) q.without_keywords = params.withoutKeywordsCsv;
  const url = `${TMDB_BASE}/discover/movie?${new URLSearchParams({ ...q, api_key: apiKey }).toString()}`;
  const debugUrl = url.replace(/api_key=[^&]+/, 'api_key=***');
  if (process.env.NODE_ENV === 'development') {
    const discoverParams = {
      page: q.page,
      sort_by: q.sort_by,
      with_genres: q.with_genres ?? '(none)',
      without_genres: q.without_genres ?? '(none)',
      with_keywords: q.with_keywords ?? '(none)',
      without_keywords: q.without_keywords ?? '(none)',
      'vote_count.gte': q['vote_count.gte'],
      'vote_average.gte': q['vote_average.gte'],
    };
    console.log('[TMDB Discover] page', page, 'params:', discoverParams);
    console.log('Final TMDB Discover URL:', debugUrl);
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

/** If strict `with_keywords` harvest returns fewer unique rows than this, strip keywords and re-harvest (OR genres + popularity). */
const KEYWORD_SAFETY_VALVE_MIN_UNIQUE = 40;

/** After vibe filter, pad with popular same-genre titles so the client grid rarely runs empty. */
const MIN_RANKED_BEFORE_PADDING = 40;

/** Max Discover rows merged before density pre-rank (popularity + long-tail). */
export const DISCOVER_CANDIDATE_MAX = 1000;
/** Movies fully enriched and returned to the client after ranking. */
export const DEEP_POOL_MAX = 100;
/** Discover pages 1–5 → up to 100 raw TMDB rows (after dedupe) before enrich + vibe resort. */
const DEEP_REVIEW_RAW_MAX = 100;

export type GetTmdbMatchesOptions = {
  /** @deprecated Deep review uses discover pages 1–5 only; ignored. */
  discoverStartPage?: number;
};

function dedupeDiscoverRows(rows: TmdbMovieResult[]): TmdbMovieResult[] {
  const byId = new Map<number, TmdbMovieResult>();
  for (const movie of rows) {
    byId.set(movie.id, movie);
  }
  return Array.from(byId.values());
}

const PASS_A_BULLSEYE_COUNT = 100;
const PASS_B_GENRE_WIDE_COUNT = 400;
const PASS_C_DEEP_COUNT = 200;
const TMDB_DISCOVER_PAGE_SIZE = 20;
const PASS_B_PAGE_COUNT = Math.ceil(PASS_B_GENRE_WIDE_COUNT / TMDB_DISCOVER_PAGE_SIZE);
const PASS_C_PAGE_COUNT = Math.ceil(PASS_C_DEEP_COUNT / TMDB_DISCOVER_PAGE_SIZE);
/** Pass C deep sift pages (inclusive). */
const DEEP_SIFT_PAGE_MIN = 20;
const DEEP_SIFT_PAGE_MAX = 200;
const EXTRA_EXPANSION_ROUNDS = 3;
const EXTRA_EXPANSION_PAGE_COUNT = 20;
const EXTRA_EXPANSION_PAGE_MIN = 1;
const EXTRA_EXPANSION_PAGE_MAX = 400;
const DISCOVER_FETCH_CHUNK = 5;

/** In-place Fisher–Yates shuffle (copy). */
function fisherYatesShuffle<T>(items: readonly T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a;
}

/** Fisher–Yates: `count` distinct page numbers in `[min, max]` (inclusive). */
function pickRandomDistinctPages(count: number, min: number, max: number): number[] {
  const span = max - min + 1;
  const take = Math.min(Math.max(0, count), span);
  const pool = Array.from({ length: span }, (_, i) => i + min);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = a;
  }
  return pool.slice(0, take);
}

async function fetchDiscoverPagesChunked(
  apiKey: string,
  base: DiscoverFetchParams,
  genreJoinMode: 'and' | 'or',
  sortBy: NonNullable<DiscoverFetchParams['sortBy']>,
  pages: readonly number[]
): Promise<TmdbMovieResult[]> {
  const params = { ...base, genreJoinMode, sortBy };
  const chunks: TmdbMovieResult[] = [];
  for (let i = 0; i < pages.length; i += DISCOVER_FETCH_CHUNK) {
    const slice = pages.slice(i, i + DISCOVER_FETCH_CHUNK);
    const batch = await Promise.all(slice.map((page) => fetchDiscoverRaw(apiKey, params, page)));
    chunks.push(...batch.flatMap((d) => d.results ?? []));
  }
  return chunks;
}

/** Deep review: TMDB `/discover/movie` pages 1–5 with the same hard params as `discoverBase` (genre/decade/runtime/etc.). */
async function fetchDiscoverPagesOneToFive(
  apiKey: string,
  base: DiscoverFetchParams,
  genreJoinMode: 'and' | 'or'
): Promise<TmdbMovieResult[]> {
  const sortBy = base.sortBy ?? 'vote_average.desc';
  const params: DiscoverFetchParams = { ...base, genreJoinMode, sortBy };
  const pages = [1, 2, 3, 4, 5] as const;
  const batch = await Promise.all(pages.map((page) => fetchDiscoverRaw(apiKey, params, page)));
  return batch.flatMap((d) => d.results ?? []);
}

/**
 * Divergent seed: 3 passes × 2 pages in parallel to escape the popularity monoculture.
 * Classics (vote_average + vote floor) + trending (popularity) + deep cuts (revenue, random offset).
 * Merges ~120 rows → dedupe → shuffle → cap at PASS_A_BULLSEYE_COUNT.
 */
async function fetchDiscoverFirstFivePages(
  apiKey: string,
  base: DiscoverFetchParams,
  genreJoinMode: 'and' | 'or'
): Promise<TmdbMovieResult[]> {
  const common: DiscoverFetchParams = { ...base, genreJoinMode };
  const revenueStart = 2 + Math.floor(Math.random() * 9); // pages 2–10 (inclusive)
  const revenuePages = [revenueStart, revenueStart + 1];

  const [batchClassics, batchTrending, batchRevenue] = await Promise.all([
    Promise.all(
      [1, 2].map((page) =>
        fetchDiscoverRaw(
          apiKey,
          {
            ...common,
            sortBy: 'vote_average.desc',
            voteCountGte: Math.max(common.voteCountGte ?? 0, 500),
          },
          page
        )
      )
    ),
    Promise.all(
      [1, 2].map((page) =>
        fetchDiscoverRaw(
          apiKey,
          {
            ...common,
            sortBy: 'popularity.desc',
          },
          page
        )
      )
    ),
    Promise.all(
      revenuePages.map((page) =>
        fetchDiscoverRaw(
          apiKey,
          {
            ...common,
            sortBy: 'revenue.desc',
          },
          page
        )
      )
    ),
  ]);

  const merged = [...batchClassics, ...batchTrending, ...batchRevenue].flatMap((d) => d.results ?? []);
  const deduped = dedupeDiscoverRows(merged);
  const shuffled = fisherYatesShuffle(deduped);
  return shuffled.slice(0, PASS_A_BULLSEYE_COUNT);
}

/** Multi-pass Deep Pool: Pass A bullseye (400) + Pass B genre-wide (400) + Pass C deep sift (200). */
async function harvestDiscoverDeepPages(
  apiKey: string,
  discoverBase: DiscoverFetchParams,
  filters: FilterState,
  genreJoinMode: 'and' | 'or',
  opts?: { useSeedKeywords?: boolean; forcePassA?: boolean }
): Promise<TmdbMovieResult[]> {
  const useSeedKeywords = opts?.useSeedKeywords !== false;
  const seedCsv = useSeedKeywords ? commaKeywordCsvUnique(buildSliderSeedKeywordCsv(filters)) : undefined;
  const lowSeedCsv = useSeedKeywords ? commaKeywordCsvUnique(buildLowSeedKeywordCsv(filters)) : undefined;
  const medExcludeCsv = commaKeywordCsvUnique(buildMediumExclusionKeywordCsv(filters));
  const combinedWithoutCsv = commaKeywordCsvUnique(
    [lowSeedCsv, medExcludeCsv].filter((x): x is string => typeof x === 'string' && x.length > 0).join(',')
  );
  const shouldRunPassA = opts?.forcePassA === true || !!seedCsv || !!combinedWithoutCsv;
  const passAPageCount = 6; // 2 classics + 2 trending + 2 revenue (divergent seed)
  const passBPages = Array.from({ length: PASS_B_PAGE_COUNT }, (_, i) => i + 1);
  const passCPages = pickRandomDistinctPages(PASS_C_PAGE_COUNT, DEEP_SIFT_PAGE_MIN, DEEP_SIFT_PAGE_MAX);
  console.log('[Discover] Pass pages', {
    passA: shouldRunPassA ? `divergent:${passAPageCount}pages(classics+trending+revenue)` : [],
    passB: passBPages,
    passC: passCPages,
    passASeedWithKeywords: seedCsv ?? '(none)',
    passASeedWithoutKeywords: combinedWithoutCsv || '(none)',
    passASeedMode: useSeedKeywords ? 'seeded' : 'unseeded',
  });
  const keywordFreeSmartHarvest: SmartHarvestQuerySlice = {
    ...(discoverBase.smartHarvest ?? emptySmartHarvestSlice()),
    withKeywordsOr: undefined,
    withoutKeywordsOr: undefined,
  };

  const passABase: DiscoverFetchParams = {
    ...discoverBase,
    withKeywordsCsv: seedCsv,
    withoutKeywordsCsv: combinedWithoutCsv || undefined,
  };
  const passBBase: DiscoverFetchParams = {
    ...discoverBase,
    smartHarvest: keywordFreeSmartHarvest,
    withKeywordsCsv: undefined,
    withoutKeywordsCsv: medExcludeCsv || undefined,
    sortBy: 'vote_count.desc',
  };
  const passCBase: DiscoverFetchParams = {
    ...discoverBase,
    smartHarvest: keywordFreeSmartHarvest,
    withKeywordsCsv: undefined,
    withoutKeywordsCsv: medExcludeCsv || undefined,
    sortBy: 'popularity.desc',
  };

  const [batchA, batchB, batchC] = await Promise.all([
    shouldRunPassA
      ? fetchDiscoverFirstFivePages(apiKey, passABase, genreJoinMode)
      : Promise.resolve([] as TmdbMovieResult[]),
    fetchDiscoverPagesChunked(apiKey, passBBase, genreJoinMode, 'vote_count.desc', passBPages),
    fetchDiscoverPagesChunked(apiKey, passCBase, genreJoinMode, 'popularity.desc', passCPages),
  ]);
  const fetchedRowsInitial = batchA.length + batchB.length + batchC.length;
  const pagesInitial = (shouldRunPassA ? passAPageCount : 0) + passBPages.length + passCPages.length;

  let passA = dedupeDiscoverRows(batchA).slice(0, PASS_A_BULLSEYE_COUNT);
  const passAIds = new Set(passA.map((m) => m.id));
  let passB = dedupeDiscoverRows(batchB)
    .filter((m) => !passAIds.has(m.id))
    .slice(0, PASS_B_GENRE_WIDE_COUNT);
  const seededIds = new Set([...Array.from(passAIds), ...passB.map((m) => m.id)]);
  let passC = dedupeDiscoverRows(batchC)
    .filter((m) => !seededIds.has(m.id))
    .slice(0, PASS_C_DEEP_COUNT);

  let unique = dedupeDiscoverRows([...passA, ...passB, ...passC]);
  if (unique.length < KEYWORD_SAFETY_VALVE_MIN_UNIQUE) {
    const deepRelaxedPages = pickRandomDistinctPages(PASS_C_PAGE_COUNT, DEEP_SIFT_PAGE_MIN, DEEP_SIFT_PAGE_MAX);
    const extraDeep = await fetchDiscoverPagesChunked(
      apiKey,
      {
        ...discoverBase,
        smartHarvest: keywordFreeSmartHarvest,
        sortBy: 'popularity.desc',
        withKeywordsCsv: undefined,
        withoutKeywordsCsv: medExcludeCsv || undefined,
      },
      genreJoinMode,
      'popularity.desc',
      deepRelaxedPages
    );
    unique = dedupeDiscoverRows([...unique, ...extraDeep]);
  }

  // Organic breadth expansion: sample additional random page blocks before we give up on density.
  let expansionPages = 0;
  let expansionRows = 0;
  for (let round = 0; round < EXTRA_EXPANSION_ROUNDS && unique.length < DISCOVER_CANDIDATE_MAX; round++) {
    const extraPages = pickRandomDistinctPages(
      EXTRA_EXPANSION_PAGE_COUNT,
      EXTRA_EXPANSION_PAGE_MIN,
      EXTRA_EXPANSION_PAGE_MAX
    );
    const extra = await fetchDiscoverPagesChunked(
      apiKey,
      {
        ...discoverBase,
        smartHarvest: keywordFreeSmartHarvest,
        sortBy: 'popularity.desc',
        withKeywordsCsv: undefined,
        withoutKeywordsCsv: medExcludeCsv || undefined,
      },
      genreJoinMode,
      'popularity.desc',
      extraPages
    );
    expansionPages += extraPages.length;
    expansionRows += extra.length;
    unique = dedupeDiscoverRows([...unique, ...extra]);
  }

  const capped = unique.slice(0, DISCOVER_CANDIDATE_MAX);
  console.log(
    '[Discover] Multi-pass pool: A(bullseye keywords) + B(vote_count genre-wide) + C(deep sift p20–200) unique',
    unique.length,
    '→ capped',
    capped.length
  );
  console.log('[Discover] Coverage audit', {
    pages_initial: pagesInitial,
    rows_initial: fetchedRowsInitial,
    pages_expansion: expansionPages,
    rows_expansion: expansionRows,
    pages_total: pagesInitial + expansionPages,
    rows_total: fetchedRowsInitial + expansionRows,
  });
  return capped;
}

/** Map Energy sliders (0–100) to a minimum TMDB `vote_average` floor (5.0–7.0). */
function energySlidersToVoteAverageGte(filters: FilterState): number {
  const keys = [
    'narrative_pacing',
    'emotional_tone',
    'brain_power',
    'visual_style',
    'suspense_level',
    'world_style',
  ] as const;
  let sum = 0;
  for (const k of keys) sum += filters[k] ?? 50;
  const avg = sum / keys.length;
  return 5 + (avg / 100) * 2;
}

/** Apply Discover quality floor from energy sliders (merged with Star Power / Top Rated floors). */
function applyEnergyVoteAverageFloor(discoverBase: DiscoverFetchParams, filters: FilterState): void {
  if (anyEmotionSliderAbove70(filters)) return;
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

/** When vibe filtering leaves too few rows, add popular Discover titles in the user’s genre(s) for a full grid. */
async function padRankedPoolIfThin(
  apiKey: string,
  filters: FilterState,
  genreJoinMode: 'and' | 'or',
  ranked: Movie[]
): Promise<Movie[]> {
  if (ranked.length >= MIN_RANKED_BEFORE_PADDING) return ranked;
  const excluded = new Set(ranked.map((m) => tmdbIdFromMovieId(m.id)));
  const padDiscover: DiscoverFetchParams = {
    genre: filters.genre.length ? filters.genre : [],
    decade: filters.decade,
    runtime: filters.runtime,
    oscarFilter: null,
    smartHarvest: emptySmartHarvestSlice(),
    sortBy: 'vote_average.desc',
    voteCountGte: 500,
  };
  const padRaw = await harvestDiscoverDeepPages(
    apiKey,
    padDiscover,
    filters,
    filters.genre.length >= 2 ? genreJoinMode : 'and',
    { useSeedKeywords: false, forcePassA: true }
  );
  const fresh = padRaw.filter((r) => !excluded.has(r.id));
  if (fresh.length === 0) return ranked;
  const padEnriched = await enrichDiscoverPool(apiKey, fresh.slice(0, DEEP_POOL_MAX));
  const out = [...ranked];
  for (const m of padEnriched) {
    const id = tmdbIdFromMovieId(m.id);
    if (excluded.has(id)) continue;
    if (filters.genre.length > 0 && !m.genre.some((g) => filters.genre.includes(g))) continue;
    excluded.add(id);
    const tr = combinedTopRatedMatchScore(m);
    m.matchPercentage = Math.max(28, Math.round(tr * 0.5));
    m.finalMatchScore = tr * 0.5;
    out.push(m);
    if (out.length >= DEEP_POOL_MAX) break;
  }
  console.log('[Discover] Padded ranked pool:', ranked.length, '→', out.length);
  return out;
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
  const weights = {
    narrative_pacing: filters.narrative_pacing,
    emotional_tone: filters.emotional_tone,
    brain_power: filters.brain_power,
    visual_style: filters.visual_style,
    suspense_level: filters.suspense_level,
    world_style: filters.world_style,
    intentResolved: {
      narrative_pacing: nearestFilterWeightStop(filters.narrative_pacing ?? 50) / 100,
      emotional_tone: nearestFilterWeightStop(filters.emotional_tone ?? 50) / 100,
      brain_power: nearestFilterWeightStop(filters.brain_power ?? 50) / 100,
      visual_style: nearestFilterWeightStop(filters.visual_style ?? 50) / 100,
      suspense_level: nearestFilterWeightStop(filters.suspense_level ?? 50) / 100,
      world_style: nearestFilterWeightStop(filters.world_style ?? 50) / 100,
    },
  };
  console.log('DEBUG: Incoming User Weights:', weights);

  const oscarFilter = filters.oscarFilter;
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

  /**
   * Prestige (director prominence) 80–100 + Oscar Any: strict Best Picture pool only (winners + nominees truth list).
   */
  if (
    filters.directorProminence === 'high' &&
    filters.oscarFilter == null
  ) {
    const ids = getOscarBothIds();
    return fetchAndEnrichByIds(apiKey, ids, isOscarListedId, filters);
  }

  const baseParams: {
    genre: FilterState['genre'];
    decade: FilterState['decade'];
    runtime: FilterState['runtime'];
    oscarFilter: FilterState['oscarFilter'];
    sortBy?:
      | 'vote_count.desc'
      | 'vote_count.asc'
      | 'vote_average.desc'
      | 'popularity.desc'
      | 'primary_release_date.desc'
      | 'primary_release_date.asc';
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
    oscarFilter: filters.oscarFilter,
  };

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

  const smartHarvest = stripAnimationFromWithoutGenres({ withKeywordIds: [], withoutKeywordIds: [] });
  if (process.env.NODE_ENV === 'development') {
    console.log('[Cinematch] Smart Harvest', smartHarvest);
  }

  const activeBaselineGenres: FilterState['genre'] =
    (baseParams.genre ?? []).length > 0 ? (baseParams.genre ?? []) : ([] as FilterState['genre']);
  const discoverBase: DiscoverFetchParams = {
    genre: activeBaselineGenres,
    decade: baseParams.decade,
    runtime: baseParams.runtime,
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
  if (filters.aListCast === 'low') {
    discoverBase.voteCountGte = 50;
    discoverBase.voteCountLte = 3000;
    discoverBase.sortBy = 'vote_average.desc';
    discoverBase.voteAverageGte = 6.5;
  } else if (filters.aListCast === 'high') {
    discoverBase.voteCountGte = 5000;
  }
  const pacingMode = activePacingMode(filters);
  // No-drop warehouse rule: never use with_keywords in Discover URL.
  discoverBase.withKeywordsCsv = undefined;
  discoverBase.withKeywordsJoinMode = undefined;

  const indieDiscover =
    filters.aListCast === 'low' && filters.criticsVsFans == null;
  const fansDiscover = filters.criticsVsFans === 'fans';

  /**
   * Default Discover: quality + minimum engagement (no `popularity.desc` loop).
   * Skips only **Fans** sort and **indie Star Power** (low vote_count.asc) paths.
   */
  if (!indieDiscover && !fansDiscover) {
    discoverBase.sortBy = 'vote_average.desc';
    discoverBase.voteCountGte = Math.max(discoverBase.voteCountGte ?? 0, 500);
    delete discoverBase.voteCountLte;
    delete discoverBase.popularityLte;
    delete discoverBase.popularityGte;
    delete discoverBase.voteAverageGte;
  } else {
    applyEnergyVoteAverageFloor(discoverBase, filters);
  }

  const anchorBase: DiscoverFetchParams = {
    ...discoverBase,
    sortBy: 'vote_count.desc',
    genreJoinMode: activeBaselineGenres.length > 1 ? 'or' : 'and',
  };
  console.log(
    '[DEBUG anchorBase full]',
    JSON.stringify(
      {
        genre: anchorBase.genre,
        genreJoinMode: anchorBase.genreJoinMode,
        sortBy: anchorBase.sortBy,
        withKeywordsCsv: anchorBase.withKeywordsCsv,
        withoutKeywordsCsv: anchorBase.withoutKeywordsCsv,
        smartHarvest: anchorBase.smartHarvest,
        voteCountGte: anchorBase.voteCountGte,
        popularityLte: anchorBase.popularityLte,
      },
      null,
      2,
    ),
  );
  console.log(
    '[DEBUG discoverBase full]',
    JSON.stringify(
      {
        genre: discoverBase.genre,
        genreJoinMode: discoverBase.genreJoinMode,
        sortBy: discoverBase.sortBy,
        withKeywordsCsv: discoverBase.withKeywordsCsv,
        withoutKeywordsCsv: discoverBase.withoutKeywordsCsv,
        smartHarvest: discoverBase.smartHarvest,
        voteCountGte: discoverBase.voteCountGte,
        voteCountLte: discoverBase.voteCountLte,
        popularityLte: discoverBase.popularityLte,
        popularityGte: discoverBase.popularityGte,
        voteAverageGte: discoverBase.voteAverageGte,
        voteAverageLte: discoverBase.voteAverageLte,
        primaryReleaseDateGte: discoverBase.primaryReleaseDateGte,
        withKeywordsJoinMode: discoverBase.withKeywordsJoinMode,
        decade: discoverBase.decade,
        runtime: discoverBase.runtime,
        oscarFilter: discoverBase.oscarFilter,
      },
      null,
      2,
    ),
  );

  // Warehouse pull:
  // - Single genre: keep broad baseline pages 1-10.
  // - Multi genre: fetch pages 1-5 per selected genre (strict per-genre representatives), then merge+dedupe.
  const initialRows =
    activeBaselineGenres.length >= 2
      ? await Promise.all(
          activeBaselineGenres.flatMap((genre) =>
            [1, 2, 3, 4, 5].map((page) =>
              fetchDiscoverRaw(
                apiKey,
                { ...anchorBase, genre: [genre], genreJoinMode: 'and' },
                page,
              ),
            ),
          ),
        )
      : await Promise.all([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((page) => fetchDiscoverRaw(apiKey, anchorBase, page)));
  let allMovies = dedupeDiscoverRows(initialRows.flatMap((d) => d.results ?? []));

  // Multi-genre fallback: widen from AND to OR if pool is thin.
  if (allMovies.length < DEEP_POOL_MAX && activeBaselineGenres.length >= 2) {
    genreJoinMode = 'or';
    const orBase: DiscoverFetchParams = { ...anchorBase, genreJoinMode: 'or' };
    const orRows = await Promise.all([1, 2, 3, 4, 5].map((page) => fetchDiscoverRaw(apiKey, orBase, page)));
    allMovies = dedupeDiscoverRows([...allMovies, ...orRows.flatMap((d) => d.results ?? [])]);
  }

  // Hard 100 guarantee: keep backfilling next anchor pages until we have enough rows.
  let nextPage = activeBaselineGenres.length >= 2 ? 6 : 11;
  while (allMovies.length < DEEP_POOL_MAX && nextPage <= 60) {
    const extra = await fetchDiscoverRaw(
      apiKey,
      { ...anchorBase, genreJoinMode },
      nextPage
    );
    allMovies = dedupeDiscoverRows([...allMovies, ...(extra.results ?? [])]);
    nextPage += 1;
  }

  console.log('[Discover] Warehouse baseline pool', {
    genres: activeBaselineGenres,
    decade: baseParams.decade,
    genreJoinMode,
    totalRows: allMovies.length,
  });

  // Enrich full baseline pool; vibe only affects local rank, never deletion.
  const enrichedPool = await enrichDiscoverPool(apiKey, allMovies);

  const hasMissingCore = (m: Movie): boolean => {
    const missingPoster = !m.posterPath;
    const missingRating = !Number.isFinite(m.rating);
    const missingRelease = !(Number.isFinite(m.year) && (m.year ?? 0) > 0);
    return missingPoster || missingRating || missingRelease;
  };
  const scored = enrichedPool.map((movie) => {
    const baseScore = scoreMovieDeclarative(movie, filters);
    const pacingHits = pacingMode == null ? 0 : countPacingHits(movie, pacingMode);
    const pacingBoost = pacingMode != null ? pacingHits >= 3 ? 350 : pacingHits === 2 ? 200 : pacingHits === 1 ? 100 : 0 : 0;
    const genreIds = movie.genreIds ?? [];
    const primaryGenreMatchBoost = activeBaselineGenres.length > 0
      ? activeBaselineGenres.reduce((acc, g) => {
          const id = GENRE_NAME_TO_ID[g];
          if (!id) return acc;
          if (genreIds[0] === id) return acc + 400;   // primary genre match
          if (genreIds.includes(id)) return acc + 20; // secondary genre match
          return acc - 400;                            // genre not present at all
        }, 0)
      : 0;
    const primaryGenrePenalty = activeBaselineGenres.length > 0
      ? activeBaselineGenres.reduce((acc, g) => {
          const id = GENRE_NAME_TO_ID[g];
          if (!id) return acc;
          if (genreIds.includes(id)) return acc;
          return acc - 400;
        }, 0)
      : 0;
    const pedigreeBoost = calculatePedigreeScore(movie, filters);
    const qualityBuffer = (movie.rating ?? 0) * 5;
    const missingDataPenalty = hasMissingCore(movie) ? 1000 : 0;
    const totalScore =
      qualityBuffer +
      pacingBoost +
      primaryGenreMatchBoost +
      pedigreeBoost +
      baseScore.finalVibeScore * 0.2 -
      missingDataPenalty;
    return {
      movie,
      score: baseScore,
      pacingHits,
      pacingBoost,
      pedigreeBoost,
      totalScore,
      primaryGenreMatchBoost,
      primaryGenrePenalty,
    };
  });
  console.log(
    '[PACING DEBUG]',
    scored.slice(0, 30).map((s) => ({
      title: s.movie.title,
      pacingHits: s.pacingHits,
      pacingBoost: s.pacingBoost,
      overview: s.movie.overview?.slice(0, 80),
    })),
  );
  console.log('Total Pool Size:', scored.length);
  const selectedGenreIds = activeBaselineGenres.map(g => GENRE_NAME_TO_ID[g]).filter((id): id is number => id != null);
  const finalScored = scored.filter(s => {
    if (selectedGenreIds.length === 0) return true;
    const movieGenreIds = s.movie.genreIds ?? [];
    return selectedGenreIds.some(id => movieGenreIds.includes(id));
  }).sort((a, b) => b.totalScore - a.totalScore).slice(0, DEEP_POOL_MAX);

  console.log('[Discover] Vibe resort (manifest weights)', {
    ranked: enrichedPool.length,
    returned: finalScored.length,
    withActiveVibe: scored.some((s) => s.score.primaryMatches + s.score.secondaryMatches > 0),
  });

  const auditRows = finalScored.slice(0, 20).map(({ movie, score, totalScore, pacingBoost, pedigreeBoost, primaryGenreMatchBoost, primaryGenrePenalty }) => ({ Title: movie.title, Total: Math.round(totalScore), Quality: Math.round((movie.rating ?? 0) * 5), Pop: movie.popularity, GenreBoost: Math.round(primaryGenreMatchBoost), PrimaryGenre: movie.genreIds?.[0], Genres: movie.genreIds?.join(','), PrimaryPenalty: primaryGenrePenalty, Pri: score.primaryMatches, Sec: score.secondaryMatches }));
  console.table(auditRows);

  const pool = finalScored.map((x) => x.movie);
  for (let i = 0; i < pool.length; i++) {
    const m = pool[i]!;
    const fs = finalScored[i]!.totalScore;
    m.finalMatchScore = fs;
    m.matchPercentage = Math.max(0, Math.min(100, Math.round(fs / 8)));
    m.vibeDensityScore = finalScored[i]!.score.baseVibeScore;
  }
  const hasActiveVibe = AXES.some((axis) => filters[axis] != null) || activeBaselineGenres.length >= 2 || filters.aListCast != null || filters.directorProminence != null || filters.oscarFilter != null || filters.criticsVsFans != null;
  const finalResults = hasActiveVibe ? await claudeRerank(pool, filters, apiKey) : pool.slice(0, 36);
  console.log('Total Movies Returned (deep-review vibe pool):', finalResults.length);
  return finalResults;
}
