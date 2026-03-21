/**
 * Smart Harvest: maps Energy sliders → TMDB Discover keyword / genre augmentation.
 * High slider (>80): `with_keywords` OR + optional genre OR when user picked no genres.
 * Low slider (<20): `without_keywords` on that axis’s **high** list + targeted `without_genres`.
 */
import type { FilterState } from './types';
import { GENRE_NAME_TO_ID, type SmartHarvestQuerySlice } from './tmdb';
import { VIBE_EXTREME_MAP } from './vibeScore';
import { VIBE_EXTREME_PHRASE_TO_TMDB_KEYWORD_ID } from './tmdbVibeKeywordBridge';

const SLIDER_HIGH = 80;
const SLIDER_LOW = 20;

/** TMDB War genre — exclude at discover when user wants strong Romance (keywords miss “war” tag). */
const TMDB_GENRE_WAR = 10752;

function normPhrase(s: string): string {
  return s.toLowerCase().replace(/-/g, ' ').trim();
}

function phraseIdsFromList(phrases: readonly string[]): number[] {
  const ids = new Set<number>();
  for (const p of phrases) {
    const id = VIBE_EXTREME_PHRASE_TO_TMDB_KEYWORD_ID[normPhrase(p)];
    if (id != null) ids.add(id);
  }
  return Array.from(ids);
}

const ENERGY_AXES = ['pacing', 'cryMeter', 'humor', 'romance', 'suspense'] as const;

export function buildSmartHarvestAugmentation(filters: FilterState): SmartHarvestQuerySlice {
  const withKw = new Set<number>();
  const withoutKw = new Set<number>();

  for (const axis of ENERGY_AXES) {
    const v = filters[axis];
    const { high } = VIBE_EXTREME_MAP[axis];
    if (v > SLIDER_HIGH) {
      for (const id of phraseIdsFromList(high)) withKw.add(id);
    }
    if (v < SLIDER_LOW) {
      for (const id of phraseIdsFromList(high)) withoutKw.add(id);
    }
  }

  const withoutGenres = new Set<number>();
  if (filters.romance > SLIDER_HIGH) withoutGenres.add(TMDB_GENRE_WAR);
  if (filters.romance < SLIDER_LOW) withoutGenres.add(GENRE_NAME_TO_ID.Romance);
  if (filters.humor < SLIDER_LOW) withoutGenres.add(GENRE_NAME_TO_ID.Comedy);

  let withGenresOr: string | undefined;
  if (filters.genre.length === 0) {
    const or = new Set<number>();
    if (filters.romance > SLIDER_HIGH) or.add(GENRE_NAME_TO_ID.Romance);
    if (filters.humor > SLIDER_HIGH) or.add(GENRE_NAME_TO_ID.Comedy);
    if (filters.pacing > SLIDER_HIGH) {
      or.add(GENRE_NAME_TO_ID.Action);
      or.add(GENRE_NAME_TO_ID.Thriller);
    }
    if (filters.cryMeter > SLIDER_HIGH) or.add(GENRE_NAME_TO_ID.Drama);
    if (filters.suspense > SLIDER_HIGH) {
      or.add(GENRE_NAME_TO_ID.Thriller);
      or.add(GENRE_NAME_TO_ID.Mystery);
      or.add(GENRE_NAME_TO_ID.Horror);
    }
    if (or.size > 0) withGenresOr = Array.from(or).join('|');
  }

  return {
    withKeywordIds: Array.from(withKw),
    withoutKeywordIds: Array.from(withoutKw),
    withGenresOr,
    withoutGenres: withoutGenres.size > 0 ? Array.from(withoutGenres).join(',') : undefined,
  };
}
