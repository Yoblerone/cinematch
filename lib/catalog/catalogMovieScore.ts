import type { FilterState, Movie } from '@/lib/types';
import { GENRE_NAME_TO_ID } from '@/lib/tmdb';
import { combinedTopRatedMatchScore } from '@/lib/criticsFansRank';
import { prestigeDirectorMatch } from '@/lib/prestigeScore';
import { PROMINENCE_TRUTH_LIST } from '@/lib/prominence';
import { isOscarListedId, isOscarNomineeId, isOscarWinnerId } from '@/lib/data/oscar-truth';
import { parseTmdbMovieId } from '@/lib/tmdb';
import { nearestFilterWeightStop, FILTER_WEIGHT_HIGH, FILTER_WEIGHT_LOW } from '@/lib/filterWeightSegments';
import { pacingKeywords } from '@/lib/scoring/pacingElastic';
import {
  computeMovieThematicDensity,
  type ThematicDensityResult,
} from '@/lib/scoring/thematicDensity';
import type { EnergyManifestAxis } from '@/lib/scoring/energyManifest';

const ENERGY_AXES: EnergyManifestAxis[] = [
  'narrative_pacing',
  'emotional_tone',
  'brain_power',
  'visual_style',
  'suspense_level',
  'world_style',
];

const VIBE_DENSITY_WEIGHT = 3.2;
const SLIDER_ALIGN_WEIGHT = 4.5;
const VISIBILITY_WEIGHT = 0.55;

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

function narrativePacingBoost(movie: Movie, filters: FilterState): number {
  const raw = filters.narrative_pacing;
  if (raw == null) return 0;
  const stop = nearestFilterWeightStop(raw);
  const text = normalizePacingText(
    [movie.overview ?? '', movie.tagline ?? '', ...(movie.keywordNames ?? [])].join(' ')
  );
  const hits =
    stop === FILTER_WEIGHT_HIGH
      ? countPacingKeywordHits(text, pacingKeywords.fast)
      : stop === FILTER_WEIGHT_LOW
        ? countPacingKeywordHits(text, pacingKeywords.slow)
        : 0;
  if (hits >= 3) return 350;
  if (hits === 2) return 200;
  if (hits === 1) return 100;
  return 0;
}

function hasActiveEnergyAxis(filters: FilterState): boolean {
  for (const axis of ENERGY_AXES) {
    const v = filters[axis];
    if (v == null) continue;
    const stop = nearestFilterWeightStop(v);
    if (stop === FILTER_WEIGHT_HIGH || stop === FILTER_WEIGHT_LOW) return true;
  }
  return false;
}

function movieAxisValue(movie: Movie, axis: EnergyManifestAxis): number {
  const v = movie[axis];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const legacy: Record<EnergyManifestAxis, number | undefined> = {
    narrative_pacing: movie.pacing,
    emotional_tone: movie.cryMeter,
    brain_power: movie.humor,
    visual_style: movie.romance,
    suspense_level: movie.suspense,
    world_style: movie.intensity,
  };
  return legacy[axis] ?? 50;
}

/**
 * Catalog-only: compare user slider intent to keyword-derived profile stored on each row.
 */
export function catalogSliderAlignmentBoost(movie: Movie, filters: FilterState): number {
  let boost = 0;
  for (const axis of ENERGY_AXES) {
    const raw = filters[axis];
    if (raw == null) continue;
    const stop = nearestFilterWeightStop(raw);
    if (stop !== FILTER_WEIGHT_HIGH && stop !== FILTER_WEIGHT_LOW) continue;
    const target = stop === FILTER_WEIGHT_HIGH ? 90 : 10;
    const dist = Math.abs(movieAxisValue(movie, axis) - target);
    boost += Math.max(0, 110 - dist);
  }
  return boost;
}

function pedigreeBoost(movie: Movie, filters: FilterState): number {
  let score = 0;
  if (filters.oscarFilter != null) {
    const id = parseTmdbMovieId(movie.id);
    if (filters.oscarFilter === 'winner') score += isOscarWinnerId(id) ? 20 : 0;
    else if (filters.oscarFilter === 'nominee') score += isOscarNomineeId(id) ? 20 : 0;
    else score += isOscarListedId(id) ? 20 : 0;
  }
  if (filters.directorProminence != null) {
    const dirSlider = filters.directorProminence === 'high' ? 90 : 10;
    const dirMatch = prestigeDirectorMatch(movie, dirSlider, PROMINENCE_TRUTH_LIST);
    score += (dirMatch - 50) * 4;
  }
  if (filters.criticsVsFans === 'both') {
    const topRatedScore = combinedTopRatedMatchScore(movie);
    score += (topRatedScore - 50) * 2;
  }
  return score;
}

function primaryGenreBoost(movie: Movie, filters: FilterState): number {
  const selectedGenreIds = filters.genre
    .map((g) => GENRE_NAME_TO_ID[g])
    .filter((id): id is number => id != null);
  if (selectedGenreIds.length === 0) return 0;
  const genreIds = movie.genreIds ?? [];
  return selectedGenreIds.reduce((acc, gid) => {
    if (genreIds[0] === gid) return acc + 400;
    if (genreIds.includes(gid)) return acc + 20;
    return acc - 400;
  }, 0);
}

function visibilityBoost(movie: Movie): number {
  const pop = Math.max(0, movie.popularity ?? 0);
  const votes = Math.max(0, movie.voteCount ?? 0);
  return Math.min(400, Math.log1p(pop) * 70 + Math.log1p(votes) * 28);
}

/** Down-rank famous titles that score weakly on the user's active energy axes for this search. */
function catalogFameMismatchPenalty(
  movie: Movie,
  filters: FilterState,
  thematic: ThematicDensityResult,
  energyActive: boolean
): number {
  if (!energyActive) return 0;
  const votes = movie.voteCount ?? 0;
  if (votes < 10_000) return 0;
  if (thematic.density_score >= 22) return 0;
  return Math.min(280, Math.log1p(votes) * 12);
}

export function catalogHasActiveEnergyAxis(filters: FilterState): boolean {
  return hasActiveEnergyAxis(filters);
}

export type CatalogMovieScore = {
  thematic: ThematicDensityResult;
  totalScore: number;
  pacingBoost: number;
  sliderAlignment: number;
};

/** Catalog ranking: manifest density + stored slider profile + pacing (not TMDB discover). */
export function scoreCatalogMovie(movie: Movie, filters: FilterState): CatalogMovieScore {
  const thematic = computeMovieThematicDensity(movie, filters);
  const energyActive = hasActiveEnergyAxis(filters);
  const pacingBoost = narrativePacingBoost(movie, filters);
  const genreBoost = primaryGenreBoost(movie, filters);
  const pedigree = pedigreeBoost(movie, filters);
  const sliderAlignment = catalogSliderAlignmentBoost(movie, filters);
  const qualityBuffer = (movie.rating ?? 0) * 4;
  const visibility = visibilityBoost(movie);
  const famePenalty = catalogFameMismatchPenalty(movie, filters, thematic, energyActive);

  const totalScore =
    qualityBuffer +
    pacingBoost +
    genreBoost +
    pedigree +
    visibility * VISIBILITY_WEIGHT +
    thematic.density_score * VIBE_DENSITY_WEIGHT +
    sliderAlignment * SLIDER_ALIGN_WEIGHT -
    famePenalty;

  return { thematic, totalScore, pacingBoost, sliderAlignment };
}
