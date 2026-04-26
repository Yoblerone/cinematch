import type { Movie, FilterState } from '@/lib/types';
import { nearestFilterWeightStop, FILTER_WEIGHT_HIGH } from '@/lib/filterWeightSegments';
import { ENERGY_MANIFEST, type EnergyManifestAxis, type KeywordTier } from './energyManifest';

const ENERGY_AXES: EnergyManifestAxis[] = [
  'narrative_pacing',
  'emotional_tone',
  'brain_power',
  'visual_style',
  'suspense_level',
  'world_style',
];

/** Primary manifest terms carry 10× secondary weight so keyword signal dominates popularity in ranking. */
const PRIMARY_W = 10.0;
const SECONDARY_W = 0.5;

/** Minimum weighted raw hits required when user asks Low or High on an axis. */
const STRICT_AXIS_RAW_FLOOR = 1.0;

/** If strict gate would leave fewer than this many titles, skip gating (keep pool). */
const GATE_FALLBACK_MIN = 8;

export interface TierHit {
  term: string;
  weight: number;
  count: number;
  contribution: number;
}

export interface ThematicDensityResult {
  /** Sum of per-axis (BaseScore × userIntent); same as aggregate IntensityScore. */
  vibe_density_score: number;
  /** Alias for logs / API copy. */
  density_score: number;
  topKeywords: string[];
  /** All matched manifest terms, by contribution (audit). */
  matchedKeywords: string[];
  axisFinals: Record<EnergyManifestAxis, number>;
  passesGate: boolean;
  needsStrictGate: boolean;
}

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Haystack: overview + tagline + TMDB keyword names. */
export function buildEnergyHaystack(movie: Pick<Movie, 'overview' | 'tagline' | 'keywordNames'>): string {
  const parts = [
    typeof movie.overview === 'string' ? movie.overview : '',
    movie.tagline ?? '',
    ...(movie.keywordNames ?? []),
  ];
  return normalizeText(parts.join(' \n '));
}

function countOccurrences(haystack: string, needleRaw: string): number {
  const needle = normalizeText(needleRaw);
  if (!needle) return 0;
  let count = 0;
  let idx = 0;
  while (idx < haystack.length) {
    const i = haystack.indexOf(needle, idx);
    if (i === -1) break;
    count++;
    idx = i + Math.max(1, needle.length);
  }
  return count;
}

/** BaseScore = Σ(primary)×PRIMARY_W + Σ(secondary)×0.5; `primaryRaw` sums primary contributions only (hard veto uses this). */
export function scoreKeywordTier(
  tier: KeywordTier,
  haystack: string
): { raw: number; primaryRaw: number; hits: TierHit[] } {
  let raw = 0;
  let primaryRaw = 0;
  const hits: TierHit[] = [];
  for (const term of tier.primary) {
    const c = countOccurrences(haystack, term);
    if (c > 0) {
      const contribution = c * PRIMARY_W;
      raw += contribution;
      primaryRaw += contribution;
      hits.push({ term, weight: PRIMARY_W, count: c, contribution });
    }
  }
  for (const term of tier.secondary) {
    const c = countOccurrences(haystack, term);
    if (c > 0) {
      const contribution = c * SECONDARY_W;
      raw += contribution;
      hits.push({ term, weight: SECONDARY_W, count: c, contribution });
    }
  }
  hits.sort((a, b) => b.contribution - a.contribution);
  return { raw, primaryRaw, hits };
}

function sliderIntent(filterVal: number): number {
  const stop = nearestFilterWeightStop(filterVal);
  return stop / 100;
}

/** True when any energy axis is not Medium (50) — triggers intensity-first sort. */
export function hasNonNeutralEnergyFilters(filters: FilterState): boolean {
  for (const axis of ENERGY_AXES) {
    const raw = filters[axis];
    if (raw == null) continue;
    if (nearestFilterWeightStop(raw) !== 50) return true;
  }
  return false;
}

/** Any manifest axis at **High** (0.9 intent) — primary-hit veto must not be relaxed by gate fallback. */
export function hasStrictHighEnergyAxis(filters: FilterState): boolean {
  for (const axis of ENERGY_AXES) {
    const raw = filters[axis];
    if (raw == null) continue;
    if (nearestFilterWeightStop(raw) === FILTER_WEIGHT_HIGH) return true;
  }
  return false;
}

function directionalRaw(
  axis: EnergyManifestAxis,
  haystack: string,
  intent: number
): { raw: number; primaryRaw: number; hits: TierHit[] } {
  const m = ENERGY_MANIFEST[axis];
  if (intent >= 0.85) {
    return scoreKeywordTier(m.high, haystack);
  }
  if (intent <= 0.25) {
    return scoreKeywordTier(m.low, haystack);
  }
  const hi = scoreKeywordTier(m.high, haystack);
  const lo = scoreKeywordTier(m.low, haystack);
  const merged = [...hi.hits, ...lo.hits].sort((a, b) => b.contribution - a.contribution);
  return { raw: (hi.raw + lo.raw) / 2, primaryRaw: (hi.primaryRaw + lo.primaryRaw) / 2, hits: merged };
}

/**
 * Per axis: BaseScore from primary/secondary; IntensityScore_axis = BaseScore × userIntent.
 * Aggregate `density_score` / `vibe_density_score` = Σ IntensityScore across five axes.
 */
export function computeMovieThematicDensity(movie: Movie, filters: FilterState): ThematicDensityResult {
  const haystack = buildEnergyHaystack(movie);
  const axisFinals = {} as Record<EnergyManifestAxis, number>;
  const allHits: TierHit[] = [];
  let vibe_density_score = 0;
  let needsStrictGate = false;
  const strictChecks: boolean[] = [];

  for (const axis of ENERGY_AXES) {
    const rawFilter = filters[axis];
    if (rawFilter == null) {
      axisFinals[axis] = 0;
      continue;
    }
    const intent = sliderIntent(rawFilter);
    const { raw, primaryRaw, hits } = directionalRaw(axis, haystack, intent);
    const intensityAxis = raw * intent;
    axisFinals[axis] = intensityAxis;
    vibe_density_score += intensityAxis;
    allHits.push(...hits);

    if (intent >= 0.85) {
      needsStrictGate = true;
      /** High (0.9): veto titles with zero **primary** manifest hits on this axis (secondary alone cannot carry). */
      strictChecks.push(primaryRaw >= STRICT_AXIS_RAW_FLOOR);
    } else if (intent <= 0.25) {
      needsStrictGate = true;
      strictChecks.push(raw >= STRICT_AXIS_RAW_FLOOR);
    }
  }

  allHits.sort((a, b) => b.contribution - a.contribution);
  const seen = new Set<string>();
  const matchedKeywords: string[] = [];
  for (const h of allHits) {
    const k = h.term.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    matchedKeywords.push(h.term);
  }

  const topKeywords = matchedKeywords.slice(0, 3);
  const passesGate = !needsStrictGate || strictChecks.every(Boolean);
  const density_score = vibe_density_score;

  return {
    vibe_density_score,
    density_score,
    topKeywords,
    matchedKeywords,
    axisFinals,
    passesGate,
    needsStrictGate,
  };
}

export function applyThematicDensityGate(movies: Movie[], filters: FilterState): Movie[] {
  const scored = movies.map((m) => ({ m, r: computeMovieThematicDensity(m, filters) }));
  for (const { m, r } of scored) {
    m.vibeDensityScore = r.density_score;
  }

  const anyStrict = scored.some((s) => s.r.needsStrictGate);
  if (!anyStrict) return movies;

  const gated = scored.filter((s) => s.r.passesGate).map((s) => s.m);
  const strictHigh = hasStrictHighEnergyAxis(filters);
  if (gated.length < Math.min(GATE_FALLBACK_MIN, movies.length)) {
    if (strictHigh) return gated;
    return movies;
  }
  return gated;
}

/** Debug: top 5 by current list order — matched manifest terms + `density_score`. */
export function logThematicDensityTopFive(movies: Movie[], filters: FilterState): void {
  const slice = movies.slice(0, 5);
  for (let i = 0; i < slice.length; i++) {
    const m = slice[i]!;
    const r = computeMovieThematicDensity(m, filters);
    console.log('[ThematicDensity]', {
      rank: i + 1,
      title: m.title,
      id: m.id,
      matchedKeywords: r.matchedKeywords,
      density_score: Number(r.density_score.toFixed(4)),
      axisFinals: r.axisFinals,
    });
  }
}
