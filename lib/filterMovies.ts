import type { Movie, FilterState } from './types';
import { FILTER_WEIGHT_MED, nearestFilterWeightStop } from './filterWeightSegments';
import {
  combinedTopRatedMatchScore,
  criticsFansMultiplier,
} from './criticsFansRank';
import { GENRE_NAME_TO_ID } from './tmdb';
import { calculateCustomRank, PROMINENCE_TRUTH_LIST } from './prominence';
import {
  calculateEnergyScore,
  calculateScore,
  getNormalizedKeywordNames,
  listMatchedPhrases,
  VIBE_CONFLICT_MAP,
} from './vibeScore';
import {
  applyThematicDensityGate,
  hasNonNeutralEnergyFilters,
  logThematicDensityTopFive,
} from './scoring/thematicDensity';
import { applyPacingElasticRerank } from './scoring/pacingElastic';
import { eraSelectionIsOnlyNewReleases, movieMatchesEra } from './era';
import { movieMatchesRuntime } from './runtime';

/** Critics/fans applied last on a 0–100 normalized scale (metadata order: genre → penalties → bonuses → CF). */
const CRITICS_FANS_WEIGHT = 0.42;
const EXTREME_VIBE_WEIGHT = 0.8;
const EXTREME_POP_QUALITY_WEIGHT = 0.2;

const CULT_POPULARITY_MIN = 5;
const CULT_VOTE_COUNT_MIN = 1000;
const CULT_VOTE_COUNT_MAX = 15000;
const CULT_RATING_MIN = 7.0;
const CULT_AGE_YEARS = 10;

/** Legacy blockbusters-style signal (popularity + votes); ranking uses `calculateCustomRank` for cast/director. */
export function prominenceScore(movie: Movie): number {
  const pop = movie.popularity ?? 0;
  const votes = movie.voteCount ?? 0;
  return pop + Math.log10(1 + votes) * 10;
}

/** Cult Signature: longevity (high popularity today + 10+ years old) + devotion (rating > 7, vote count in cult range). */
export function hasCultSignature(m: {
  popularity?: number;
  voteCount?: number;
  rating: number;
  year: number;
}): boolean {
  const year = m.year || 0;
  const currentYear = new Date().getFullYear();
  const longevity = year > 0 && currentYear - year >= CULT_AGE_YEARS && (m.popularity ?? 0) >= CULT_POPULARITY_MIN;
  const devotion =
    m.rating > CULT_RATING_MIN &&
    (m.voteCount ?? 0) >= CULT_VOTE_COUNT_MIN &&
    (m.voteCount ?? 0) <= CULT_VOTE_COUNT_MAX;
  return longevity && devotion;
}

const BAND = 35;
const ATMOSPHERE_POINTS_PER_TAG = 100;
const CULT_CLASSIC_BUDGET_MAX = 5_000_000; // $5M
const CULT_CLASSIC_YEAR_MAX = 2020; // release before 2020

/** Cult Classic atmosphere: budget < $5M AND revenue > budget AND release < 2020. */
function isCultClassicByNumbers(m: { budget: number; boxOffice: number; year: number }): boolean {
  return (
    m.budget < CULT_CLASSIC_BUDGET_MAX &&
    m.boxOffice > m.budget &&
    m.year > 0 &&
    m.year < CULT_CLASSIC_YEAR_MAX
  );
}

function inBand(movieVal: number, filterVal: number): boolean {
  return movieVal >= filterVal - BAND && movieVal <= filterVal + BAND;
}

function eraMatch(movie: Movie, eras: FilterState['decade']): boolean {
  return movieMatchesEra(movie, eras);
}

/** Cumulative atmosphere score: +100 per selected tag that matches (Cult Classic can match by budget/revenue/year). */
function atmosphereScore(movie: Movie, filters: FilterState): number {
  void movie;
  void filters;
  return 0;
}

/** True when the movie’s TMDB `genre_ids` include every selected genre id (preferred), else name fallback. */
export function movieHasAllSelectedGenres(movie: Movie, filters: FilterState): boolean {
  if (filters.genre.length === 0) return false;
  const needed = filters.genre.map((g) => GENRE_NAME_TO_ID[g]).filter((id): id is number => id != null);
  if (needed.length !== filters.genre.length) {
    return filters.genre.every((g) => movie.genre.includes(g));
  }
  const ids = movie.genreIds;
  if (ids != null && ids.length > 0) {
    return needed.every((id) => ids.includes(id));
  }
  return filters.genre.every((g) => movie.genre.includes(g));
}

/**
 * Taste / filter alignment only (no cast/director prominence — that is `calculateCustomRank`).
 * Genre: **Perfect Match** bonus when all selected genres appear (by `genre_ids` when present).
 * 3-genre matches get a larger bonus than 2-genre.
 */
/**
 * Taste alignment without Energy sliders (atmosphere, genre bonuses, Oscar, decade, etc.).
 * Match % / sort use `scoreGenreForMatch` + `calculateEnergyScore` + weighted critics/fans; this stays for tooling/debug.
 */
export function scoreMovieTasteNonVibe(movie: Movie, filters: FilterState): number {
  let score = atmosphereScore(movie, filters);
  if (filters.crowd != null && movie.crowd.includes(filters.crowd)) score += 2;
  if (filters.genre.length > 0) {
    const allMatch = movieHasAllSelectedGenres(movie, filters);
    if (allMatch) {
      const n = filters.genre.length;
      /** Base Perfect Match + per-genre tick; triple-genre gets a clear lift over double. */
      score += 50 + n * 2;
      if (n >= 2) score += 12;
      if (n >= 3) score += 38;
    }
  }
  if (filters.oscarFilter === 'nominee') {
    if (movie.oscarNominee) score += 1;
  }
  if (filters.oscarFilter === 'both') {
    if (movie.oscarNominee) score += 1;
    if (movie.oscarWinner) score += 500;
  }
  if (filters.oscarFilter === 'winner') {
    if (movie.oscarWinner) score += 500;
  }
  if (filters.decade.length > 0 && eraMatch(movie, filters.decade)) score += 1;
  if (filters.runtime.length > 0 && movieMatchesRuntime(movie.runtimeMinutes, filters.runtime)) {
    score += 1;
  }
  return score;
}

/** Genre alignment for match % (60% bucket, half of that shared with critics/fans). */
function scoreGenreForMatch(movie: Movie, filters: FilterState): number {
  if (filters.genre.length === 0) return 50;
  if (movieHasAllSelectedGenres(movie, filters)) {
    const n = filters.genre.length;
    return 40 + n * 25 + (n >= 2 ? 30 : 0) + (n >= 3 ? 45 : 0);
  }
  return 18;
}

/** Critics vs fans alignment for match % (same 60% bucket as genre). */
function scoreCriticsFansForMatch(movie: Movie, filters: FilterState): number {
  if (filters.criticsVsFans == null) return 50;
  if (filters.criticsVsFans === 'both') {
    return combinedTopRatedMatchScore(movie);
  }
  return criticsFansMultiplier(movie, filters) * 40;
}

/** @deprecated Legacy taste + energy bands; ranking uses genre + CF + vibe blend. */
export function scoreMovieTaste(movie: Movie, filters: FilterState): number {
  let score = scoreMovieTasteNonVibe(movie, filters);
  for (const key of ['pacing', 'cryMeter', 'humor', 'romance', 'suspense'] as const) {
    const fv = filters[key] ?? 50;
    if (inBand(movie[key], fv)) score += 1;
    score += (30 - Math.min(Math.abs(movie[key] - fv), 30)) / 30;
  }
  return score;
}

export type FilterMoviesOptions = {
  /**
   * `all` (default): movie must include every selected genre (strict AND).
   * `any`: movie must match at least one selected genre — used after TMDB OR fallback so the pool isn’t empty.
   */
  genreFilterMode?: 'all' | 'any';
  /** @deprecated No-op — max-slider keyword trim removed; kept for call-site compatibility. */
  skipMaxSliderVibeTrim?: boolean;
  /** Declarative engine path: skip legacy thematic gate and let caller handle strict/soft selection. */
  skipThematicDensityGate?: boolean;
};

export function filterMovies(
  movieList: Movie[],
  filters: FilterState,
  options?: FilterMoviesOptions
): Movie[] {
  const genreFilterMode = options?.genreFilterMode ?? 'all';
  const filtered = movieList.filter((movie) => {
    if (filters.crowd != null && !movie.crowd.includes(filters.crowd)) return false;
    if (filters.genre.length > 0) {
      if (genreFilterMode === 'any') {
        if (!filters.genre.some((g) => movie.genre.includes(g))) return false;
      } else if (!filters.genre.every((g) => movie.genre.includes(g))) return false;
    }
    if (
      filters.decade.length > 0 &&
      !eraSelectionIsOnlyNewReleases(filters.decade) &&
      !eraMatch(movie, filters.decade)
    ) {
      return false;
    }
    if (filters.runtime.length > 0 && !movieMatchesRuntime(movie.runtimeMinutes, filters.runtime)) {
      return false;
    }
    return true;
  });

  const pool = options?.skipThematicDensityGate ? filtered : applyThematicDensityGate(filtered, filters);

  const genreRaws = pool.map((m) => scoreGenreForMatch(m, filters));
  const cfRaws = pool.map((m) => scoreCriticsFansForMatch(m, filters));
  const minC = cfRaws.length ? Math.min(...cfRaws) : 0;
  const maxC = cfRaws.length ? Math.max(...cfRaws) : 1;
  const cfNorm01 = (c: number) => (maxC === minC ? 0.5 : (c - minC) / (maxC - minC));
  const anySliderAt100 =
    filters.pacing === 100 ||
    filters.cryMeter === 100 ||
    filters.humor === 100 ||
    filters.romance === 100 ||
    filters.suspense === 100;

  /** Tiny tie-break so ordering is stable; does not swamp genre + energy. */
  const tieBreak = (m: Movie) =>
    (m.rating ?? 0) * 0.04 + Math.log1p(m.voteCount ?? 0) * 0.02;

  /**
   * Hierarchy: **Genre (base)** → **main plot** (anchor / protagonist / antagonist from `VIBE_CONFLICT_MAP`)
   * → **metadata** (`VIBE_EXTREME_MAP` nukes + fine-tuning) → **critics/fans** (weighted) → tie-break.
   */
  const vibeRaws = pool.map((m) => {
    const { penalties, bonuses } = calculateEnergyScore(m, filters);
    return penalties + bonuses;
  });

  const customRaws = pool.map((m) => calculateCustomRank(m, filters, PROMINENCE_TRUTH_LIST));
  const prominenceWeight =
    filters.aListCast != null || filters.directorProminence != null ? 0.26 : 0;

  const popQualityRaws = pool.map((m, i) => {
    const g = genreRaws[i]!;
    const c = cfRaws[i]!;
    const cfComponent = CRITICS_FANS_WEIGHT * cfNorm01(c) * 100;
    return g + cfComponent + tieBreak(m);
  });

  const norm01 = (arr: number[]): number[] => {
    const lo = arr.length ? Math.min(...arr) : 0;
    const hi = arr.length ? Math.max(...arr) : 1;
    const span = hi - lo;
    if (span <= 1e-12) return arr.map(() => 0.5);
    return arr.map((x) => (x - lo) / span);
  };

  const vibe01 = norm01(vibeRaws);
  const popQuality01 = norm01(popQualityRaws);
  const custom01 = norm01(customRaws);
  const preScores = pool.map((_, i) => {
    const base = anySliderAt100
      ? EXTREME_VIBE_WEIGHT * vibe01[i]! + EXTREME_POP_QUALITY_WEIGHT * popQuality01[i]!
      : vibe01[i]! + popQuality01[i]!;
    if (prominenceWeight <= 0) return base;
    return (1 - prominenceWeight) * base + prominenceWeight * custom01[i]!;
  });

  const minP = preScores.length ? Math.min(...preScores) : 0;
  const maxP = preScores.length ? Math.max(...preScores) : 1;
  const spanP = maxP - minP;

  const ranked = pool.map((m, i) => {
    const customRank = customRaws[i]!;
    m.customRank = customRank;
    const blend01 =
      spanP <= 1e-12 ? 0.5 : (preScores[i]! - minP) / spanP;
    return { movie: m, blend01 };
  });

  ranked.forEach((x) => {
    x.movie.finalMatchScore = x.blend01 * 100;
    x.movie.matchPercentage = Math.round(x.blend01 * 100);
  });

  /** Strict order by finalMatchScore, then tie-breaks. */
  ranked.sort((a, b) => {
    const fs = (b.movie.finalMatchScore ?? 0) - (a.movie.finalMatchScore ?? 0);
    if (Math.abs(fs) > 1e-12) return fs > 0 ? 1 : -1;
    const mp = (b.movie.matchPercentage ?? 0) - (a.movie.matchPercentage ?? 0);
    if (mp !== 0) return mp > 0 ? 1 : -1;
    const diffBlend = b.blend01 - a.blend01;
    if (Math.abs(diffBlend) > 1e-12) return diffBlend > 0 ? 1 : -1;
    const br = b.movie.rating ?? 0;
    const ar = a.movie.rating ?? 0;
    if (br !== ar) return br > ar ? 1 : -1;
    return (b.movie.voteCount ?? 0) - (a.movie.voteCount ?? 0);
  });

  const rankedFiltered = ranked;

  if (process.env.NODE_ENV === 'development' && rankedFiltered.length > 0) {
    const first = rankedFiltered[0]!.movie;
    const kw = first.keywordNames ?? [];
    console.log(`[GoodReels] #1 result keywords (${first.title})`, {
      count: kw.length,
      keywords: kw,
      hint:
        kw.length === 0
          ? 'No keywords — verify TMDB append_to_response=keywords and /movie/{id}/keywords merge in tmdbEnrich.enrichMovie'
          : undefined,
    });

    const top5 = rankedFiltered.slice(0, 5);
    const payload = top5.map(({ movie: m }, idx) => {
      const gi = pool.indexOf(m);
      const g = gi >= 0 ? scoreGenreForMatch(m, filters) : 0;
      const c = gi >= 0 ? cfRaws[gi]! : 0;
      const cfComponent = CRITICS_FANS_WEIGHT * cfNorm01(c) * 100;
      const breakdown = calculateScore(m, filters, g, cfComponent);
      return {
        rank: idx + 1,
        title: m.title,
        matchPercentage: m.matchPercentage,
        ...breakdown,
        keywordCount: (m.keywordNames ?? []).length,
      };
    });
    console.log(
      '[GoodReels] Top 5 match breakdown (genre → main plot → metadata → CF):',
      JSON.stringify(payload, null, 2)
    );

    /** Logic audit: Romance slider > 85 — antagonist hits (e.g. war) must apply −100 and sink war films. */
    if ((filters.romance ?? 50) > 85) {
      const romanceAnt = VIBE_CONFLICT_MAP.romance.antagonists;
      const top = ranked[0]?.movie;
      if (top) {
        const kn = getNormalizedKeywordNames(top);
        const matchedAnt = listMatchedPhrases(kn, romanceAnt);
        const energy = calculateEnergyScore(top, filters);
        const romAxis = energy.axes.find((a) => a.axis === 'romance');
        console.log('[GoodReels] Romance>85 #1 main-plot audit', {
          title: top.title,
          keywordCount: top.keywordNames?.length ?? 0,
          keywords: top.keywordNames ?? [],
          matchedRomanceAntagonists: matchedAnt,
          antagonistPenaltyApplied: romAxis?.antagonistConflictPenalty ?? 0,
          expectedNukeIfWarLike: matchedAnt.length > 0 ? -100 : 0,
        });
      }

      const dunkirkEntry = rankedFiltered.find((r) => r.movie.title.toLowerCase().includes('dunkirk'));
      if (dunkirkEntry) {
        const m = dunkirkEntry.movie;
        const kn = getNormalizedKeywordNames(m);
        const matchedAnt = listMatchedPhrases(kn, romanceAnt);
        const energy = calculateEnergyScore(m, filters);
        const romAxis = energy.axes.find((a) => a.axis === 'romance');
        console.warn('[GoodReels] Dunkirk still in ranked list (Romance>85) — conflict audit', {
          rankApprox: rankedFiltered.indexOf(dunkirkEntry) + 1,
          title: m.title,
          keywords: m.keywordNames ?? [],
          matchedRomanceAntagonists: matchedAnt,
          antagonistPenaltyApplied: romAxis?.antagonistConflictPenalty ?? 0,
          warOrMilitaryInKeywords:
            matchedAnt.includes('war') ||
            matchedAnt.includes('military') ||
            (m.keywordNames ?? []).some((x) => /war|military|battle/i.test(x)),
        });
      }
    }
  }

  let out = rankedFiltered.map((x) => x.movie);
  out = applyPacingElasticRerank(out, filters);

  /** Intensity-first order when any energy axis is Low/High (non-50); tie-break on blend score. */
  const hasActiveBinaryPacing =
    filters.narrative_pacing != null && nearestFilterWeightStop(filters.narrative_pacing) !== FILTER_WEIGHT_MED;
  if (hasNonNeutralEnergyFilters(filters) && !hasActiveBinaryPacing) {
    out = [...out].sort((a, b) => {
      const dDens = (b.vibeDensityScore ?? 0) - (a.vibeDensityScore ?? 0);
      if (Math.abs(dDens) > 1e-9) return dDens > 0 ? 1 : -1;
      const dFinal = (b.finalMatchScore ?? 0) - (a.finalMatchScore ?? 0);
      if (Math.abs(dFinal) > 1e-9) return dFinal > 0 ? 1 : -1;
      return (b.matchPercentage ?? 0) - (a.matchPercentage ?? 0);
    });
  }

  if (process.env.NODE_ENV !== 'production' || process.env.THEMATIC_DENSITY_AUDIT === '1') {
    logThematicDensityTopFive(out, filters);
  }

  out = applyFranchiseDiversityCap(out);

  return out;
}

/**
 * Franchise diversity: for movies belonging to the same TMDB collection, keep only the
 * highest-ranked entry (already at the top of `movies` since input is ranked).
 * Movies with no collection (collectionId null/undefined) are always kept.
 */
function applyFranchiseDiversityCap(movies: import('./types').Movie[]): import('./types').Movie[] {
  const seenCollections = new Set<number>();
  return movies.filter((m) => {
    if (!m.collectionId) return true;
    if (seenCollections.has(m.collectionId)) return false;
    seenCollections.add(m.collectionId);
    return true;
  });
}
