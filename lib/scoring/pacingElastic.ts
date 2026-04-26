import { FILTER_WEIGHT_HIGH, FILTER_WEIGHT_LOW, nearestFilterWeightStop } from '@/lib/filterWeightSegments';
import type { FilterState, Movie } from '@/lib/types';

export const pacingKeywords = {
  fast: [
    'ticking clock',
    'suspense',
    'thriller',
    'chase',
    'non-stop action',
    'heist',
    'chaotic',
    'high stakes',
    'survival',
    'escape',
    'crime spree',
    'fast-paced',
    'breathless',
    'intense',
    'adrenaline',
    'manhunt',
    'double cross',
    'rescue mission',
    'explosive',
    // overlap tags for high-velocity dramas
    'frantic',
    'chaos',
    'pulse-pounding',
    'rapid-fire',
  ],
  slow: [
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
    // overlap tags for patient cinema
    'poetic',
    'patient',
  ],
} as const;

const STRONG_MATCH_FLOOR = 40;
const PRIMARY_MULTIPLIER = 1.8;
const OPPOSING_PENALTY = 0.4;
const DEFAULT_REQUIRED_HITS = 3;
const FALLBACK_REQUIRED_HITS = 1;

type PacingMode = 'fast' | 'slow';

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function moviePacingHaystack(movie: Movie): string[] {
  const names = (movie.keywordNames ?? []).map((k) => normalizeText(k));
  if (names.length > 0) return names;
  const merged = [movie.overview ?? '', movie.tagline ?? ''].filter(Boolean).join(' ');
  return [normalizeText(merged)];
}

function countHits(haystack: string[], bucket: readonly string[]): number {
  let hits = 0;
  for (const term of bucket) {
    const needle = normalizeText(term);
    if (!needle) continue;
    const matched = haystack.some((k) => k === needle || k.includes(needle) || needle.includes(k));
    if (matched) hits += 1;
  }
  return hits;
}

function activePacingMode(filters: FilterState): PacingMode | null {
  if (filters.narrative_pacing == null) return null;
  const stop = nearestFilterWeightStop(filters.narrative_pacing);
  if (stop === FILTER_WEIGHT_HIGH) return 'fast';
  if (stop === FILTER_WEIGHT_LOW) return 'slow';
  return null;
}

export function applyPacingElasticRerank(movies: Movie[], filters: FilterState): Movie[] {
  const mode = activePacingMode(filters);
  if (mode == null || movies.length === 0) return movies;

  const scored = movies.map((movie) => {
    const haystack = moviePacingHaystack(movie);
    const fastHits = countHits(haystack, pacingKeywords.fast);
    const slowHits = countHits(haystack, pacingKeywords.slow);
    return { movie, fastHits, slowHits };
  });

  const primaryHits = mode === 'fast' ? 'fastHits' : 'slowHits';
  const strongMatchesAtThree = scored.filter((s) => s[primaryHits] >= DEFAULT_REQUIRED_HITS).length;
  const requiredHits = strongMatchesAtThree < STRONG_MATCH_FLOOR ? FALLBACK_REQUIRED_HITS : DEFAULT_REQUIRED_HITS;

  const boosted = scored.map((entry) => {
    const base = entry.movie.finalMatchScore ?? entry.movie.matchPercentage ?? 0;
    let elastic = base;

    if (entry[primaryHits] >= requiredHits) {
      elastic *= PRIMARY_MULTIPLIER;
    }
    const opposingHits = mode === 'fast' ? entry.slowHits : entry.fastHits;
    if (opposingHits > 0) {
      elastic *= OPPOSING_PENALTY;
    }

    entry.movie.finalMatchScore = elastic;
    entry.movie.matchPercentage = Math.round(Math.max(0, Math.min(100, elastic)));
    return { ...entry, elastic };
  });

  boosted.sort((a, b) => {
    const delta = b.elastic - a.elastic;
    if (Math.abs(delta) > 1e-9) return delta > 0 ? 1 : -1;
    return (b.movie.voteCount ?? 0) - (a.movie.voteCount ?? 0);
  });

  return boosted.map((x) => x.movie);
}
