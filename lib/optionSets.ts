import type { VisualStyle, Soundtrack, Genre, Theme } from './types';

/** 6 tags per carousel view (2 rows × 3 columns). */
export const TAGS_PER_PAGE = 6;

/** 18 Theme/Mood tags (atmosphere ranking). */
export const ALL_THEME_OPTIONS: Theme[] = [
  'Cult Classic',
  'Adrenaline',
  'Speculative',
  'The Dark Side',
  'Human Condition',
  'Based on True Story',
  'Twist Ending',
  'Road Trip',
  'Fish out of Water',
  'Against the Clock',
  'Identity Crisis',
  'Whimsical',
  'Heartfelt',
  'Cynical',
  'Philosophical',
  'Satirical',
  'Surreal',
  'Melancholy',
];

/** 18 Visual Moods (TMDB keyword–driven ranking). */
export const ALL_VISUAL_STYLE_OPTIONS: VisualStyle[] = [
  'Noir Shadows',
  'Neon Dystopia',
  'Found Footage',
  'Technicolor Dream',
  'Symmetric Frames',
  'Gritty Realism',
  'Wide Scope Epic',
  'Gothic Horror',
  'Retro Grain',
  'One-Take',
  'Handheld Kinetic',
  'Pop Art',
  'High Contrast',
  'Period',
  'Warm Tones',
  'Cold Tones',
  'Saturated',
  'Aerial',
];

/** 18 Sound Profile tags. */
export const ALL_SOUNDTRACK_OPTIONS: Soundtrack[] = [
  'Sweeping Orchestral',
  'The Modern Pulse',
  'Vintage/Analog',
  'Intimate/Acoustic',
  'Experimental',
  'Jazz',
  'Orchestral',
  'Ambient',
  'Synth',
  'World Music',
  'Acoustic',
  'Percussion-heavy',
  'Vocal-led',
  'Minimal',
  'Classical',
  'Silent',
  'No Score',
  'Diegetic Only',
];

/** Chunk options into pages of 6 for 2×3 carousel; arrows slide to next/prev 6. */
function toPages<T>(arr: T[], pageSize: number = TAGS_PER_PAGE): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < arr.length; i += pageSize) {
    pages.push(arr.slice(i, i + pageSize));
  }
  return pages.length ? pages : [[]];
}

export const THEME_SETS: Theme[][] = toPages(ALL_THEME_OPTIONS);
export const VISUAL_STYLE_SETS: VisualStyle[][] = toPages(ALL_VISUAL_STYLE_OPTIONS);
export const SOUNDTRACK_SETS: Soundtrack[][] = toPages(ALL_SOUNDTRACK_OPTIONS);

export const GENRE_OPTIONS: Genre[] = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama',
  'Family', 'Fantasy', 'History', 'Horror', 'Music', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller', 'War', 'Western',
];

export const DEFAULT_THEME_OPTIONS: Theme[] = ALL_THEME_OPTIONS;
export const DEFAULT_VISUAL_STYLE_OPTIONS: VisualStyle[] = ALL_VISUAL_STYLE_OPTIONS;
export const DEFAULT_SOUNDTRACK_OPTIONS: Soundtrack[] = ALL_SOUNDTRACK_OPTIONS;
