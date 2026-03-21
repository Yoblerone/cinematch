import type { FilterState, Movie } from './types';
import truthListJson from './data/truth-list.json';

export interface TruthPerson {
  id: number;
  name: string;
}

export interface ProminenceTruthList {
  elite_directors: TruthPerson[];
  a_list_actors: TruthPerson[];
}

/** Canonical TMDB id lists — edit `lib/data/truth-list.json`. */
export const PROMINENCE_TRUTH_LIST = truthListJson as ProminenceTruthList;

/** Hard ceiling at slider 0: truth-list hit OR TMDB popularity above this → -1000. */
const HARD_CEILING_POP = 10;

const HARD_CEILING_PENALTY = -1000;

/** Mid-tier band for "50" (recognizable, not superstars). */
const MID_TIER_LO = 8;
const MID_TIER_HI = 25;

/** Sliders ~50 — small UI drift still hits mid-tier mode. */
const SLIDER_MID_LO = 45;
const SLIDER_MID_HI = 55;

/** Truth list only strongly rewarded at high slider values. */
const SLIDER_ELITE_MIN = 90;

/** Penalty when an elite truth-list name appears while targeting mid-tier (~50). */
const ELITE_AT_MID_PENALTY = -200;

const SCORE_MIN = -1000;
const SCORE_MAX = 100;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function eliteDirectorIds(list: ProminenceTruthList): Set<number> {
  return new Set(list.elite_directors.map((d) => d.id));
}

function aListActorIds(list: ProminenceTruthList): Set<number> {
  return new Set(list.a_list_actors.map((a) => a.id));
}

function clampMatch(n: number): number {
  return clamp(n, SCORE_MIN, SCORE_MAX);
}

/** Top 2 leads by TMDB billing order. */
function topTwoLeads(movie: Movie): NonNullable<Movie['castCredits']> {
  const raw = movie.castCredits ?? [];
  const sorted = [...raw].sort(
    (a, b) => (a.order ?? 999) - (b.order ?? 999)
  );
  return sorted.slice(0, 2);
}

export function calculateProminenceScore(
  movie: Movie,
  sliders: { cast: number; director: number },
  truthList: ProminenceTruthList = PROMINENCE_TRUTH_LIST
): { castMatch: number; directorMatch: number } {
  const eliteD = eliteDirectorIds(truthList);
  const aList = aListActorIds(truthList);

  const topCast = topTwoLeads(movie);
  const avgCastPopularity = average(topCast.map((c) => c.popularity ?? 0));
  const hasAListActor = topCast.some(
    (c) =>
      (c.id > 0 && aList.has(c.id)) ||
      truthList.a_list_actors.some((a) => a.name === c.name)
  );

  const director = (movie.crewCredits ?? []).find((m) => m.job === 'Director');
  const directorPopRaw =
    director?.popularity ?? movie.directorPopularityRaw ?? movie.directorProminence ?? 0;
  const directorId = director?.id ?? 0;
  const isEliteDirector =
    (directorId > 0 && eliteD.has(directorId)) ||
    (director != null && truthList.elite_directors.some((d) => d.name === director.name));

  let castMatch = 0;

  if (sliders.cast <= 0) {
    const anyActorOverCeiling = topCast.some((c) => (c.popularity ?? 0) > HARD_CEILING_POP);
    const disqualified = hasAListActor || anyActorOverCeiling;
    castMatch = disqualified ? HARD_CEILING_PENALTY : 100;
  } else if (sliders.cast >= SLIDER_MID_LO && sliders.cast <= SLIDER_MID_HI) {
    const inMidBand = avgCastPopularity >= MID_TIER_LO && avgCastPopularity <= MID_TIER_HI;
    if (inMidBand && !hasAListActor) castMatch = 100;
    else if (hasAListActor) castMatch = ELITE_AT_MID_PENALTY;
    else castMatch = 20;
  } else if (sliders.cast >= SLIDER_ELITE_MIN) {
    castMatch = hasAListActor ? 100 : 0;
  } else {
    const inMidBand = avgCastPopularity >= MID_TIER_LO && avgCastPopularity <= MID_TIER_HI;
    castMatch = inMidBand && !hasAListActor ? 70 : 30;
  }

  let directorMatch = 0;

  if (sliders.director <= 0) {
    const disqualified = isEliteDirector || directorPopRaw > HARD_CEILING_POP;
    directorMatch = disqualified ? HARD_CEILING_PENALTY : 100;
  } else if (sliders.director >= SLIDER_ELITE_MIN) {
    directorMatch = isEliteDirector ? 100 : clamp(directorPopRaw, 0, 100);
  } else if (sliders.director >= SLIDER_MID_LO && sliders.director <= SLIDER_MID_HI) {
    const inMidBand = directorPopRaw >= MID_TIER_LO && directorPopRaw <= MID_TIER_HI;
    if (inMidBand && !isEliteDirector) directorMatch = 100;
    else if (isEliteDirector) directorMatch = ELITE_AT_MID_PENALTY;
    else directorMatch = 30;
  } else {
    const inMidBand = directorPopRaw >= MID_TIER_LO && directorPopRaw <= MID_TIER_HI;
    directorMatch = inMidBand && !isEliteDirector ? 100 : 30;
  }

  return {
    castMatch: clampMatch(castMatch),
    directorMatch: clampMatch(directorMatch),
  };
}

export function calculateCustomRank(
  movie: Movie,
  filters: FilterState,
  truthList: ProminenceTruthList = PROMINENCE_TRUTH_LIST
): number {
  const castSlider = filters.aListCastAny ? 50 : filters.aListCast;
  const directorSlider = filters.directorProminenceAny ? 50 : filters.directorProminence;
  const { castMatch, directorMatch } = calculateProminenceScore(
    movie,
    { cast: castSlider, director: directorSlider },
    truthList
  );
  return castMatch * 0.5 + directorMatch * 0.5;
}
