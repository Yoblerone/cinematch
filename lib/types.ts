export type CrowdType = 'Solo' | 'Date Night' | 'Group';

/** 18 Visual Moods (TMDB keyword–driven ranking). */
export type VisualStyle =
  | 'Noir Shadows'
  | 'Neon Dystopia'
  | 'Found Footage'
  | 'Technicolor Dream'
  | 'Symmetric Frames'
  | 'Gritty Realism'
  | 'Wide Scope Epic'
  | 'Gothic Horror'
  | 'Retro Grain'
  | 'One-Take'
  | 'Handheld Kinetic'
  | 'Pop Art'
  | 'High Contrast'
  | 'Period'
  | 'Warm Tones'
  | 'Cold Tones'
  | 'Saturated'
  | 'Aerial';

/** 18 Sound Profile tags (TMDB keyword–driven ranking). */
export type Soundtrack =
  | 'Sweeping Orchestral'
  | 'The Modern Pulse'
  | 'Vintage/Analog'
  | 'Intimate/Acoustic'
  | 'Experimental'
  | 'Jazz'
  | 'Orchestral'
  | 'Ambient'
  | 'Synth'
  | 'World Music'
  | 'Acoustic'
  | 'Percussion-heavy'
  | 'Vocal-led'
  | 'Minimal'
  | 'Classical'
  | 'Silent'
  | 'No Score'
  | 'Diegetic Only';

// TMDB genre list (with_genres) - includes Family
export type Genre =
  | 'Action'
  | 'Adventure'
  | 'Animation'
  | 'Comedy'
  | 'Crime'
  | 'Documentary'
  | 'Drama'
  | 'Family'
  | 'Fantasy'
  | 'History'
  | 'Horror'
  | 'Music'
  | 'Mystery'
  | 'Romance'
  | 'Sci-Fi'
  | 'Thriller'
  | 'War'
  | 'Western';

/** 18 Theme/Mood tags (TMDB keyword–driven ranking). Cult Classic can also match budget/revenue/year. */
export type Theme =
  | 'Cult Classic'
  | 'Adrenaline'
  | 'Speculative'
  | 'The Dark Side'
  | 'Human Condition'
  | 'Based on True Story'
  | 'Twist Ending'
  | 'Road Trip'
  | 'Fish out of Water'
  | 'Against the Clock'
  | 'Identity Crisis'
  | 'Whimsical'
  | 'Heartfelt'
  | 'Cynical'
  | 'Philosophical'
  | 'Satirical'
  | 'Surreal'
  | 'Melancholy';

export type CriticsVsFans = 'critics' | 'fans' | 'both';

export type Decade = '60s' | '70s' | '80s' | '90s' | '2000s' | '2010s' | '2020s' | null;

export type Runtime = 'short' | 'medium' | 'long' | null; // short <90, medium 90–150, long 150+

export interface Movie {
  id: string;
  title: string;
  year: number;
  tagline: string;
  posterColor: string;
  /** TMDB poster_path (e.g. "/abc.jpg"); build URL with https://image.tmdb.org/t/p/w500{posterPath} */
  posterPath?: string | null;
  crowd: CrowdType[];
  pacing: number;
  intensity: number;
  cryMeter: number;
  humor: number;      // 0 = dead serious, 100 = slapstick
  romance: number;    // 0 = none, 100 = full-on
  suspense: number;   // 0 = calm, 100 = white-knuckle
  genre: Genre[];
  /** TMDB `genre_ids` when available — used for perfect multi-genre match scoring. */
  genreIds?: number[];
  /** TMDB keyword names from movie details (append_to_response=keywords) — vibe scoring. */
  keywordNames?: string[];
  theme: Theme[];
  visualStyle: VisualStyle[];
  soundtrack: Soundtrack[];
  boxOffice: number;
  budget: number;
  /** TMDB `vote_average` (0–10), same scale as TMDB website. */
  rating: number;
  hasAListCast: boolean;
  /** Star power score for ranking: 0 (no A-List in top 5), 30 (1–2 A-List), 100 (3+ A-List). A-List = TMDB person popularity > 50. */
  starPowerScore?: number;
  criticsVsFans: CriticsVsFans;
  oscarWinner: boolean;
  oscarNominee: boolean;
  /** Best Picture award year (e.g. 2024). Set when movie is in academy VIP list. */
  academyAwardYear?: number;
  /** Best Picture award type for label (e.g. "Academy Award Winner 2024"). */
  academyAwardType?: 'Winner' | 'Nominee';
  runtimeMinutes: number;
  /** 0–100; maps to TMDB person popularity (director) when using API */
  directorProminence: number;
  /** Raw TMDB director popularity (same scale as cast credits) — used for prominence scoring. */
  directorPopularityRaw?: number;
  /** TMDB movie popularity (for Cult Signature: longevity). */
  popularity?: number;
  /** TMDB vote_count (for Cult Signature: devotion range 1k–15k). */
  voteCount?: number;
  /** IMDB id (e.g. "tt0137523") for linking to https://www.imdb.com/title/{imdbId}/ */
  imdbId?: string | null;
  /** YouTube video id from TMDB append videos, or null when missing / not a YouTube Trailer. */
  trailerKey?: string | null;
  /** Lightweight credits for prominence ranking (top cast + director). IDs = TMDB person id. */
  castCredits?: { id: number; name: string; popularity: number; order?: number }[];
  crewCredits?: { id: number; name: string; job: string; popularity: number }[];
  /** Composite ranking signal from prominence utility. */
  customRank?: number;
  /** 0–100 match % from server ranking (taste + prominence); highest = best match. */
  matchPercentage?: number;
  /** Internal final rank score used for ordering before formatting to percentage. */
  finalMatchScore?: number;
}

/** Max genres user can select (TMDB discover uses AND for multiple). */
export const MAX_GENRES = 3;

export interface FilterState {
  crowd: CrowdType | null;
  pacing: number;
  intensity: number;
  cryMeter: number;
  humor: number;
  romance: number;
  suspense: number;
  /** Up to MAX_GENRES; empty = any. Multiple genres = AND (must match all). */
  genre: Genre[];
  theme: Theme[];
  visualStyle: VisualStyle[];
  soundtrack: Soundtrack[];
  cultClassic: boolean | null;
  /** When true, star power is ignored (slider disabled). When false, aListCast 0–100 ranks by star power. */
  aListCastAny: boolean;
  /** 0–100; only used when aListCastAny is false. 100 = highest star power first, 0 = lowest (indie ensembles) first. */
  aListCast: number;
  criticsVsFans: CriticsVsFans | null;
  /**
   * Best Picture (Academy Awards) filter.
   * - `winner`: winners only
   * - `nominee`: nominees only (excluding winners)
   * - `both`: winners + nominees
   * - `any`: no Best Picture filtering
   */
  oscarFilter: 'any' | 'nominee' | 'winner' | 'both';
  /** Multiple decades; empty = any. Date range spans min–max. */
  decade: Decade[];
  runtime: Runtime;
  /** When true, prominence is ignored (slider disabled). When false, directorProminence 0–100 is used for API and ranking. */
  directorProminenceAny: boolean;
  /** 0–100; only used when directorProminenceAny is false. */
  directorProminence: number;
}

export const defaultFilters: FilterState = {
  crowd: null,
  pacing: 50,
  intensity: 50,
  cryMeter: 50,
  humor: 50,
  romance: 50,
  suspense: 50,
  genre: [],
  theme: [],
  visualStyle: [],
  soundtrack: [],
  cultClassic: null,
  aListCastAny: true,
  aListCast: 50,
  criticsVsFans: null,
  oscarFilter: 'any',
  decade: [],
  runtime: null,
  directorProminenceAny: true,
  directorProminence: 50,
};
