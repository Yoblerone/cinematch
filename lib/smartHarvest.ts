/**
 * Smart Harvest: emotion axes → TMDB Discover (numeric keyword IDs, pipe = OR).
 *
 * - **0 (hard zero):** Absolute `without_genres` for that mood + `without_keywords`.
 * - **1–20:** `without_keywords` only (soft block; genres not banned at API level).
 * - **21–29:** Neutral — no with/without from that axis.
 * - **30–79:** Genre bias only (no slider keyword OR).
 * - **80–100:** Full single pipe `with_keywords` per axis (not stepped).
 *
 * TMDB requires keyword **IDs**; pipes are OR, never comma-AND.
 * User genre selections are never placed in `without_genres`.
 */
import type { FilterState } from './types';
import { GENRE_NAME_TO_ID, type SmartHarvestQuerySlice } from './tmdb';
import { getSlider100ConflictGenreIds } from './genreConflictMap';

const BLOCK_MAX = 20;
const NEUTRAL_MAX = 29;
const MID_MIN = 30;
const MID_MAX = 79;
const HIGH_MIN = 80;

const G = GENRE_NAME_TO_ID;

/** Cry (80–100). */
const KW_CRY = '11612|10683|31522|233157';
/** Romance 80–100 — Star-crossed | True Love | Relationship (per product spec). */
const KW_ROMANCE = '165086|14534|9840';
/** Suspense (80–100). */
const KW_SUSPENSE = '12565|314730|216521|18022';
/** Energy (80–100). */
const KW_ENERGY = '234505|232185|3149|18507';
/** Whimsy (80–100). */
const KW_WHIMSY = '283250|2343|156466|236400';
/** Grit (80–100). */
const KW_GRIT = '15011|3149|155457|242566';

const KW_SIMBA_WITHOUT = '6054|210024';

const SLIDER100_AXES = ['pacing', 'cryMeter', 'humor', 'romance', 'suspense', 'intensity'] as const;

const SLIDER_100_PRIMARY_GENRE: Record<(typeof SLIDER100_AXES)[number], number> = {
  pacing: G.Action,
  cryMeter: G.Drama,
  humor: G.Comedy,
  romance: G.Romance,
  suspense: G.Thriller,
  intensity: G.Crime,
};

function sliderOn(v: number | null | undefined): boolean {
  return v != null;
}

function sliderValue(v: number | null | undefined): number {
  return v ?? 50;
}

function isHardZero(v: number): boolean {
  return v === 0;
}
function isSoftLow(v: number): boolean {
  return v >= 1 && v <= BLOCK_MAX;
}
function inNeutralBand(v: number): boolean {
  return v > BLOCK_MAX && v <= NEUTRAL_MAX;
}
function inMidGenreBand(v: number): boolean {
  return v >= MID_MIN && v <= MID_MAX;
}
function inHighBand(v: number): boolean {
  return v >= HIGH_MIN;
}

function mergeKeywordPipes(...parts: (string | undefined)[]): string | undefined {
  const s = new Set<string>();
  for (const p of parts) {
    if (!p?.trim()) continue;
    for (const x of p.split('|')) {
      const t = x.trim();
      if (t) s.add(t);
    }
  }
  if (s.size === 0) return undefined;
  return Array.from(s).join('|');
}

export function buildSlider100PrimaryGenrePipe(filters: FilterState): string | undefined {
  const ids = new Set<number>();
  for (const ax of SLIDER100_AXES) {
    if (!sliderOn(filters[ax])) continue;
    if (filters[ax] === 100) ids.add(SLIDER_100_PRIMARY_GENRE[ax]);
  }
  if (ids.size === 0) return undefined;
  return Array.from(ids).join('|');
}

export function anchorGenreOrPipeForSlider100(filters: FilterState): string | undefined {
  return buildSlider100PrimaryGenrePipe(filters);
}

export function anyEnergySliderAt100(filters: FilterState): boolean {
  return SLIDER100_AXES.some((ax) => sliderOn(filters[ax]) && filters[ax] === 100);
}

/** Any emotion axis > 70 — used with `vote_average.desc` + vote floor on Discover. */
export function anyEmotionSliderAbove70(filters: FilterState): boolean {
  return SLIDER100_AXES.some((ax) => sliderOn(filters[ax]) && sliderValue(filters[ax]) > 70);
}

export function emptySmartHarvestSlice(): SmartHarvestQuerySlice {
  return {
    withKeywordIds: [],
    withoutKeywordIds: [],
  };
}

function buildGenrePrimaryHeadComma(filters: FilterState): string | undefined {
  const head: number[] = [];
  const push = (id: number) => {
    if (!head.includes(id)) head.push(id);
  };
  if (sliderOn(filters.romance) && inHighBand(sliderValue(filters.romance))) push(G.Romance);
  if (sliderOn(filters.cryMeter) && inHighBand(sliderValue(filters.cryMeter))) push(G.Drama);
  if (sliderOn(filters.suspense) && inHighBand(sliderValue(filters.suspense))) push(G.Thriller);
  if (sliderOn(filters.pacing) && inHighBand(sliderValue(filters.pacing))) push(G.Action);
  if (sliderOn(filters.humor) && inHighBand(sliderValue(filters.humor))) push(G.Family);
  if (sliderOn(filters.intensity) && inHighBand(sliderValue(filters.intensity))) push(G.Crime);
  if (head.length === 0) return undefined;
  return head.join(',');
}

export function buildSmartHarvestAugmentation(filters: FilterState): SmartHarvestQuerySlice {
  const withoutGenreIds = new Set<number>();
  const withKwHigh: string[] = [];
  const withoutKwLow: string[] = [];
  const withGenresOr = new Set<number>();
  const withGenresAnd = new Set<number>();
  let withRuntimeGte: number | undefined;
  let withRuntimeLte: number | undefined;

  const selectedGenreIds = new Set<number>(
    filters.genre.map((g) => GENRE_NAME_TO_ID[g]).filter((id): id is number => id != null)
  );

  const addHighKeywords = (pipe: string, v: number) => {
    if (inHighBand(v)) withKwHigh.push(pipe);
  };

  // —— Cry ——
  const cry = sliderValue(filters.cryMeter);
  const pacing = sliderValue(filters.pacing);
  const suspense = sliderValue(filters.suspense);
  const humor = sliderValue(filters.humor);
  const romance = sliderValue(filters.romance);
  const intensity = sliderValue(filters.intensity);

  if (sliderOn(filters.cryMeter) && isHardZero(cry)) {
    withoutGenreIds.add(G.Drama);
    withoutKwLow.push(KW_CRY);
  } else if (sliderOn(filters.cryMeter) && isSoftLow(cry)) {
    withoutKwLow.push(KW_CRY);
  } else if (sliderOn(filters.cryMeter) && !inNeutralBand(cry)) {
    if (inMidGenreBand(cry)) withGenresAnd.add(G.Drama);
    if (inHighBand(cry)) {
      withGenresAnd.add(G.Drama);
      addHighKeywords(KW_CRY, cry);
    }
  }

  // —— Energy / pacing ——
  if (sliderOn(filters.pacing) && isHardZero(pacing)) {
    withRuntimeGte = 120;
    withoutGenreIds.add(G.Action);
    withoutGenreIds.add(G.Adventure);
    withGenresAnd.add(G.Drama);
    withGenresAnd.add(G.Romance);
    withoutKwLow.push(KW_ENERGY);
  } else if (sliderOn(filters.pacing) && isSoftLow(pacing)) {
    withRuntimeGte = 120;
    withGenresAnd.add(G.Drama);
    withGenresAnd.add(G.Romance);
    withoutKwLow.push(KW_ENERGY);
  } else if (sliderOn(filters.pacing) && !inNeutralBand(pacing)) {
    if (inMidGenreBand(pacing)) {
      withGenresOr.add(G.Action);
      withGenresOr.add(G.Adventure);
      withGenresOr.add(G.Thriller);
    }
    if (inHighBand(pacing)) {
      withGenresOr.add(G.Action);
      withGenresOr.add(G.Adventure);
      withGenresOr.add(G.Thriller);
      addHighKeywords(KW_ENERGY, pacing);
    }
  }

  // —— Suspense ——
  if (sliderOn(filters.suspense) && isHardZero(suspense)) {
    withoutGenreIds.add(G.Thriller);
    withoutGenreIds.add(G.Mystery);
    withoutGenreIds.add(G.Horror);
    withoutKwLow.push(KW_SUSPENSE);
  } else if (sliderOn(filters.suspense) && isSoftLow(suspense)) {
    withoutKwLow.push(KW_SUSPENSE);
  } else if (sliderOn(filters.suspense) && !inNeutralBand(suspense)) {
    if (inMidGenreBand(suspense)) {
      withGenresOr.add(G.Thriller);
      withGenresOr.add(G.Mystery);
    }
    if (inHighBand(suspense)) {
      withGenresOr.add(G.Thriller);
      withGenresOr.add(G.Mystery);
      addHighKeywords(KW_SUSPENSE, suspense);
    }
  }

  // —— Whimsy (humor) ——
  if (sliderOn(filters.humor) && isHardZero(humor)) {
    withoutGenreIds.add(G.Family);
    withoutGenreIds.add(G.Animation);
    withoutKwLow.push(KW_WHIMSY);
  } else if (sliderOn(filters.humor) && isSoftLow(humor)) {
    withoutKwLow.push(KW_WHIMSY);
  } else if (sliderOn(filters.humor) && !inNeutralBand(humor)) {
    if (inMidGenreBand(humor)) {
      withGenresOr.add(G.Family);
      withGenresOr.add(G.Animation);
      withGenresOr.add(G.Fantasy);
    }
    if (inHighBand(humor)) {
      withGenresOr.add(G.Family);
      withGenresOr.add(G.Animation);
      withGenresOr.add(G.Fantasy);
      addHighKeywords(KW_WHIMSY, humor);
    }
  }

  // —— Romance ——
  if (sliderOn(filters.romance) && isHardZero(romance)) {
    withoutGenreIds.add(G.Romance);
    withoutKwLow.push(KW_ROMANCE);
  } else if (sliderOn(filters.romance) && isSoftLow(romance)) {
    withoutKwLow.push(KW_ROMANCE);
  } else if (sliderOn(filters.romance) && !inNeutralBand(romance)) {
    if (inMidGenreBand(romance)) withGenresAnd.add(G.Romance);
    if (inHighBand(romance)) {
      withGenresAnd.add(G.Romance);
      addHighKeywords(KW_ROMANCE, romance);
    }
  }

  // —— Grit (intensity) ——
  if (sliderOn(filters.intensity) && isHardZero(intensity)) {
    withoutGenreIds.add(G.Crime);
    withoutKwLow.push(KW_GRIT);
  } else if (sliderOn(filters.intensity) && isSoftLow(intensity)) {
    withoutKwLow.push(KW_GRIT);
  } else if (sliderOn(filters.intensity) && !inNeutralBand(intensity)) {
    if (inMidGenreBand(intensity)) withGenresAnd.add(G.Crime);
    if (inHighBand(intensity)) {
      withGenresAnd.add(G.Crime);
      addHighKeywords(KW_GRIT, intensity);
    }
  }

  if (sliderOn(filters.romance) && sliderOn(filters.pacing) && inHighBand(romance) && pacing <= BLOCK_MAX) {
    withoutKwLow.push(KW_SIMBA_WITHOUT);
  }

  if (filters.genre.length === 0) {
    if (sliderOn(filters.humor) && inHighBand(humor) && humor < 100) withGenresOr.add(G.Comedy);
  }

  for (const id of getSlider100ConflictGenreIds(filters)) withoutGenreIds.add(id);

  Array.from(withGenresAnd).forEach((id) => withoutGenreIds.delete(id));
  Array.from(selectedGenreIds).forEach((id) => withoutGenreIds.delete(id));

  const withGenresSlider100Pipe = buildSlider100PrimaryGenrePipe(filters);
  const withGenresOrStr =
    withGenresOr.size > 0 ? Array.from(withGenresOr).join('|') : undefined;

  const withKeywordsOr = mergeKeywordPipes(...withKwHigh);
  const withoutKeywordsOr = mergeKeywordPipes(...withoutKwLow);

  const genrePrimaryHeadComma = buildGenrePrimaryHeadComma(filters);

  return {
    withKeywordIds: [],
    withoutKeywordIds: [],
    withKeywordsOr,
    withoutKeywordsOr,
    withGenresOr: withGenresOrStr,
    withGenresSlider100Pipe,
    withGenresAndComma: (() => {
      const s = new Set(withGenresAnd);
      if (!s.size) return undefined;
      return Array.from(s).join(',');
    })(),
    withoutGenres: withoutGenreIds.size > 0 ? Array.from(withoutGenreIds).join(',') : undefined,
    withRuntimeGte,
    withRuntimeLte,
    genrePrimaryHeadComma,
  };
}
