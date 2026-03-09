import type { VisualStyle, Soundtrack, Genre, Theme } from './types';

// Full lists for Director's Console - expanded for TMDB-style discover
export const ALL_VISUAL_STYLE_OPTIONS: VisualStyle[] = [
  'Film Noir', 'Vibrant', 'Gritty', 'Symmetric', 'Documentary-style', 'Period',
  'High Contrast', 'Vintage', 'Wide Scope', 'Claustrophobic', 'Natural Light', 'Neon-lit',
  'Desaturated', 'Warm Tones', 'Cold Tones', 'Single Location', 'Road Movie', 'Anthology',
  'Black and White', 'Handheld', 'Animated', 'Stop Motion', 'Split Screen', 'One Take',
  'Found Footage', 'Surreal', 'Minimalist', 'Saturated', 'Golden Hour', 'Night', 'Underwater', 'Aerial',
];

export const ALL_SOUNDTRACK_OPTIONS: Soundtrack[] = [
  'Iconic Score', 'Classic Songs', 'Electronic', 'Jazz', 'Orchestral', 'Minimal',
  'Hip-Hop & R&B', 'Rock & Guitar', 'Piano-led', 'Choir & Strings', 'Ambient', 'Latin',
  'Folk & Americana', 'No Score', 'Diegetic Only', 'Musical Numbers', 'Sound Design Heavy',
  'Classical', 'Synth', 'Country', 'Blues', 'World Music', 'Opera', 'Acoustic', 'Percussion-heavy', 'Silent', 'Vocal-led',
];

// Genres (TMDB with_genres)
export const GENRE_OPTIONS: Genre[] = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama',
  'Family', 'Fantasy', 'History', 'Horror', 'Music', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller', 'War', 'Western',
];

// Theme / TMDB with_keywords style - expanded
export const ALL_THEME_OPTIONS: Theme[] = [
  'Coming of Age', 'Revenge', 'Heist', 'Dystopia', 'Time Travel', 'Road Trip',
  'Based on True Story', 'Twist Ending', 'Dysfunctional Family', 'Fish out of Water', 'Against the Clock', 'Noir',
  'Love Triangle', 'Quest', 'Survival', 'Identity Crisis', 'Redemption', 'Escape', 'Betrayal', 'Found Family', 'Multiverse',
  'Murder', 'Detective', 'Conspiracy', 'Secret Identity', 'Alien', 'Robot', 'Superhero', 'Vampire', 'Zombie', 'Ghost', 'Witch',
  'Prison', 'School', 'Wedding', 'Christmas', 'Sports', 'Music', 'Dance', 'Art', 'Politics', 'War', 'Terrorism',
  'Kidnapping', 'Hostage', 'Bank Robbery', 'Assassin', 'Spy', 'Double Cross', 'Corruption', 'Courtroom', 'Mistaken Identity', 'Amnesia',
  'Serial Killer', 'Haunted House', 'Apocalypse', 'Space', 'Underdog', 'Rivalry', 'Friendship', 'Loss', 'Grief', 'Addiction', 'Mental Illness',
  'Immigration', 'Racism', 'LGBTQ+', 'Feminism', 'Religion', 'Philosophy', 'Nature', 'Animal', 'Ocean', 'Island',
];

// Disjoint sets for Regenerate (no option in more than one set)
export const VISUAL_STYLE_SETS: VisualStyle[][] = [
  ['Film Noir', 'Vibrant', 'Gritty', 'Symmetric', 'Documentary-style', 'Period'],
  ['High Contrast', 'Vintage', 'Wide Scope', 'Claustrophobic', 'Natural Light', 'Neon-lit'],
  ['Desaturated', 'Warm Tones', 'Cold Tones', 'Single Location', 'Road Movie', 'Anthology'],
  ['Black and White', 'Handheld', 'Animated', 'Stop Motion', 'Split Screen', 'One Take'],
  ['Found Footage', 'Surreal', 'Minimalist', 'Saturated', 'Golden Hour', 'Night'],
  ['Underwater', 'Aerial'],
];

export const SOUNDTRACK_SETS: Soundtrack[][] = [
  ['Iconic Score', 'Classic Songs', 'Electronic', 'Orchestral', 'Minimal', 'Jazz'],
  ['Hip-Hop & R&B', 'Rock & Guitar', 'Piano-led', 'Choir & Strings', 'Ambient', 'Latin'],
  ['Folk & Americana', 'No Score', 'Diegetic Only', 'Musical Numbers', 'Sound Design Heavy'],
  ['Classical', 'Synth', 'Country', 'Blues', 'World Music', 'Opera'],
  ['Acoustic', 'Percussion-heavy', 'Silent', 'Vocal-led'],
];

export const THEME_SETS: Theme[][] = [
  ['Coming of Age', 'Revenge', 'Heist', 'Dystopia', 'Time Travel', 'Road Trip'],
  ['Based on True Story', 'Twist Ending', 'Dysfunctional Family', 'Fish out of Water', 'Against the Clock', 'Noir'],
  ['Love Triangle', 'Quest', 'Survival', 'Identity Crisis', 'Redemption', 'Escape'],
  ['Betrayal', 'Found Family', 'Multiverse', 'Murder', 'Detective', 'Conspiracy'],
  ['Secret Identity', 'Alien', 'Robot', 'Superhero', 'Vampire', 'Zombie'],
  ['Ghost', 'Witch', 'Prison', 'School', 'Wedding', 'Christmas'],
  ['Sports', 'Music', 'Dance', 'Art', 'Politics', 'War'],
  ['Terrorism', 'Kidnapping', 'Hostage', 'Bank Robbery', 'Assassin', 'Spy'],
  ['Double Cross', 'Corruption', 'Courtroom', 'Mistaken Identity', 'Amnesia', 'Serial Killer'],
  ['Haunted House', 'Apocalypse', 'Space', 'Underdog', 'Rivalry', 'Friendship'],
  ['Loss', 'Grief', 'Addiction', 'Mental Illness', 'Immigration', 'Racism'],
  ['LGBTQ+', 'Feminism', 'Religion', 'Philosophy', 'Nature', 'Animal'],
  ['Ocean', 'Island'],
];

// Initial options shown (first set of each)
export const DEFAULT_VISUAL_STYLE_OPTIONS: VisualStyle[] = VISUAL_STYLE_SETS[0];
export const DEFAULT_SOUNDTRACK_OPTIONS: Soundtrack[] = SOUNDTRACK_SETS[0];
export const DEFAULT_THEME_OPTIONS: Theme[] = THEME_SETS[0];
