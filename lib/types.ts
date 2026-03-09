export type CrowdType = 'Solo' | 'Date Night' | 'Group';

export type VisualStyle =
  | 'Film Noir'
  | 'Vibrant'
  | 'Gritty'
  | 'Symmetric'
  | 'Documentary-style'
  | 'Period'
  | 'High Contrast'
  | 'Vintage'
  | 'Wide Scope'
  | 'Claustrophobic'
  | 'Natural Light'
  | 'Neon-lit'
  | 'Desaturated'
  | 'Warm Tones'
  | 'Cold Tones'
  | 'Single Location'
  | 'Road Movie'
  | 'Anthology'
  | 'Black and White'
  | 'Handheld'
  | 'Animated'
  | 'Stop Motion'
  | 'Split Screen'
  | 'One Take'
  | 'Found Footage'
  | 'Surreal'
  | 'Minimalist'
  | 'Saturated'
  | 'Golden Hour'
  | 'Night'
  | 'Underwater'
  | 'Aerial';

export type Soundtrack =
  | 'Iconic Score'
  | 'Classic Songs'
  | 'Electronic'
  | 'Jazz'
  | 'Orchestral'
  | 'Minimal'
  | 'Hip-Hop & R&B'
  | 'Rock & Guitar'
  | 'Piano-led'
  | 'Choir & Strings'
  | 'Ambient'
  | 'Latin'
  | 'Folk & Americana'
  | 'No Score'
  | 'Diegetic Only'
  | 'Musical Numbers'
  | 'Sound Design Heavy'
  | 'Classical'
  | 'Synth'
  | 'Country'
  | 'Blues'
  | 'World Music'
  | 'Opera'
  | 'Acoustic'
  | 'Percussion-heavy'
  | 'Silent'
  | 'Vocal-led';

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

// TMDB keywords (with_keywords) - theme/mood tags; expanded for TMDB-style discover
export type Theme =
  | 'Coming of Age'
  | 'Revenge'
  | 'Heist'
  | 'Dystopia'
  | 'Time Travel'
  | 'Road Trip'
  | 'Based on True Story'
  | 'Twist Ending'
  | 'Dysfunctional Family'
  | 'Fish out of Water'
  | 'Against the Clock'
  | 'Noir'
  | 'Love Triangle'
  | 'Quest'
  | 'Survival'
  | 'Identity Crisis'
  | 'Redemption'
  | 'Escape'
  | 'Betrayal'
  | 'Found Family'
  | 'Multiverse'
  | 'Murder'
  | 'Detective'
  | 'Conspiracy'
  | 'Secret Identity'
  | 'Alien'
  | 'Robot'
  | 'Superhero'
  | 'Vampire'
  | 'Zombie'
  | 'Ghost'
  | 'Witch'
  | 'Prison'
  | 'School'
  | 'Wedding'
  | 'Christmas'
  | 'Sports'
  | 'Music'
  | 'Dance'
  | 'Art'
  | 'Politics'
  | 'War'
  | 'Terrorism'
  | 'Kidnapping'
  | 'Hostage'
  | 'Bank Robbery'
  | 'Assassin'
  | 'Spy'
  | 'Double Cross'
  | 'Corruption'
  | 'Courtroom'
  | 'Mistaken Identity'
  | 'Amnesia'
  | 'Serial Killer'
  | 'Haunted House'
  | 'Apocalypse'
  | 'Space'
  | 'Underdog'
  | 'Rivalry'
  | 'Friendship'
  | 'Loss'
  | 'Grief'
  | 'Addiction'
  | 'Mental Illness'
  | 'Immigration'
  | 'Racism'
  | 'LGBTQ+'
  | 'Feminism'
  | 'Religion'
  | 'Philosophy'
  | 'Nature'
  | 'Animal'
  | 'Ocean'
  | 'Island';

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
  theme: Theme[];
  visualStyle: VisualStyle[];
  soundtrack: Soundtrack[];
  boxOffice: number;
  budget: number;
  rating: number;
  hasAListCast: boolean;
  criticsVsFans: CriticsVsFans;
  oscarWinner: boolean;
  oscarNominee: boolean;
  runtimeMinutes: number;
  /** 0–100; maps to TMDB person popularity (director) when using API */
  directorProminence: number;
  /** TMDB movie popularity (for Cult Signature: longevity). */
  popularity?: number;
  /** TMDB vote_count (for Cult Signature: devotion range 1k–15k). */
  voteCount?: number;
  /** IMDB id (e.g. "tt0137523") for linking to https://www.imdb.com/title/{imdbId}/ */
  imdbId?: string | null;
}

/** Max genres user can select (TMDB discover uses OR). */
export const MAX_GENRES = 3;

export interface FilterState {
  crowd: CrowdType | null;
  pacing: number;
  intensity: number;
  cryMeter: number;
  humor: number;
  romance: number;
  suspense: number;
  /** Up to MAX_GENRES; empty = any. TMDB with_genres OR. */
  genre: Genre[];
  theme: Theme[];
  visualStyle: VisualStyle[];
  soundtrack: Soundtrack[];
  cultClassic: boolean | null;
  aListCast: boolean | null;
  criticsVsFans: CriticsVsFans | null;
  oscarWinner: boolean | null;
  oscarNominee: boolean | null;
  /** Multiple decades; empty = any. Date range spans min–max. */
  decade: Decade[];
  runtime: Runtime;
  /** 0 = any director; 1–100 = minimum director prominence (TMDB person popularity) */
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
  aListCast: null,
  criticsVsFans: null,
  oscarWinner: null,
  oscarNominee: null,
  decade: [],
  runtime: null,
  directorProminence: 0,
};
