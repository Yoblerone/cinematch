/**
 * Energy & Emotion scoring vs TMDB `Movie.keywordNames` (merged from append + /keywords).
 * Uses `VIBE_EXTREME_MAP` only for keyword lists.
 */
import type { FilterState, Genre, Movie } from './types';
import { GENRE_NAME_TO_ID } from './tmdb';
import { GENRE_CONFLICT_MAP } from './genreConflictMap';

export const VIBE_EXTREME_MAP = {
  pacing: {
    high: [
      'chase',
      'non-stop',
      'fast-paced',
      'ticking clock',
      'adrenaline',
      'heist',
      'escape',
      'sprint',
      'breakneck',
      'high octane',
      'explosive',
      'rapid',
      'action packed',
      'thrill ride',
      'cat and mouse',
      'survival',
    ],
    low: [
      'slow burn',
      'meditative',
      'atmospheric',
      'minimalist',
      'contemplative',
      'unfolding',
      'patient',
      'static',
      'drifting',
      'stillness',
      'character study',
      'philosophical',
      'observational',
      'cerebral',
    ],
  },
  cryMeter: {
    high: [
      'tearjerker',
      'terminal illness',
      'tragedy',
      'heartbreaking',
      'grief',
      'loss of loved one',
      'sacrifice',
      'unrequited love',
      'melancholy',
      'sadness',
      'weeping',
      'emotional journey',
      'bittersweet',
      'poignant',
      'mourning',
    ],
    low: [
      'cynical',
      'stoic',
      'dark comedy',
      'dry humor',
      'misanthropic',
      'satirical',
      'unemotional',
      'cold',
      'detached',
      'irreverent',
      'nihilism',
    ],
  },
  humor: {
    high: [
      'slapstick',
      'witty',
      'absurdist',
      'irreverent',
      'satire',
      'parody',
      'sitcom',
      'banter',
      'goofy',
      'hilarious',
      'black comedy',
      'farce',
      'comedic relief',
      'quips',
      'jovial',
      'lighthearted',
    ],
    low: [
      'grim',
      'bleak',
      'somber',
      'serious',
      'dread',
      'no-nonsense',
      'gritty',
      'harsh',
      'oppressive',
      'disturbing',
      'macabre',
      'fatalistic',
    ],
  },
  romance: {
    high: [
      'love interest',
      'star crossed lovers',
      'soulmates',
      'courtship',
      'romantic yearning',
      'passion',
      'marriage',
      'infatuation',
      'forbidden love',
      'chemistry',
      'dating',
      'falling in love',
      'proposal',
      'true love',
      'sentimental',
    ],
    low: [
      'solitude',
      'lonely',
      'isolated',
      'betrayal',
      'cynicism',
      'emotional distance',
      'loveless',
      'strictly professional',
      'alienation',
      'misogyny',
      'misanthropy',
      'war',
      'military',
    ],
  },
  suspense: {
    high: [
      'twist ending',
      'paranoia',
      'mystery',
      'psychological',
      'investigation',
      'unreliable narrator',
      'conspiracy',
      'tension',
      'foreboding',
      'edge of seat',
      'stark',
      'noir',
      'whodunit',
      'macguffin',
      'intense',
    ],
    low: [
      'heartwarming',
      'slice of life',
      'predictable',
      'safe',
      'gentle',
      'calm',
      'comforting',
      'wholesome',
      'feel-good',
      'easygoing',
    ],
  },
} as const;

/**
 * Main plot vs subplot: when a slider is very high (>85), antagonist keywords imply a conflicting primary vibe.
 * Protagonists list documents the aligned “main plot” phrases; scoring uses **antagonists** only for the −100 penalty.
 */
export const VIBE_CONFLICT_MAP = {
  romance: {
    protagonists: [
      'soulmates',
      'falling in love',
      'star crossed lovers',
      'romantic comedy',
      'passion',
      'wedding',
      'proposal',
    ],
    antagonists: [
      'war',
      'military',
      'battle',
      'combat',
      'soldiers',
      'survival',
      'horror',
      'slasher',
      'crime boss',
    ],
  },
  humor: {
    protagonists: [
      'slapstick',
      'parody',
      'sitcom',
      'hilarious',
      'stand-up',
      'farce',
      'witty banter',
    ],
    antagonists: [
      'tragedy',
      'bleak',
      'funeral',
      'terminal illness',
      'serial killer',
      'torture',
      'grim',
    ],
  },
  pacing: {
    protagonists: [
      'chase',
      'ticking clock',
      'non-stop',
      'breakneck',
      'heist',
      'escape',
      'sprint',
    ],
    antagonists: [
      'slow burn',
      'meditative',
      'atmospheric',
      'minimalist',
      'period piece',
      'historical epic',
    ],
  },
  cryMeter: {
    protagonists: [
      'tearjerker',
      'heartbreaking',
      'terminal illness',
      'sacrifice',
      'grief',
      'mourning',
    ],
    antagonists: ['satire', 'parody', 'feel-good', 'slapstick', 'jovial', 'carefree'],
  },
  suspense: {
    protagonists: [
      'twist ending',
      'paranoia',
      'conspiracy',
      'unreliable narrator',
      'whodunit',
      'ticking clock',
    ],
    antagonists: [
      'slice of life',
      'predictable',
      'wholesome',
      'gentle',
      'comforting',
    ],
  },
} as const;

/**
 * When the movie’s **primary** genre (first in `movie.genre`) matches this TMDB genre for the axis
 * and the slider is in high-intent band → +`MAIN_PLOT_ANCHOR_BONUS`.
 */
export const SLIDER_ANCHOR_GENRE: Record<keyof typeof VIBE_EXTREME_MAP, Genre> = {
  pacing: 'Action',
  cryMeter: 'Drama',
  humor: 'Comedy',
  romance: 'Romance',
  suspense: 'Thriller',
};

const MAIN_PLOT_ANCHOR_BONUS = 60;
const MAIN_PLOT_PROTAGONIST_BONUS = 40;

/** Antagonist “subplot nuke” only when slider > 85 (disabled for 40–75 and 76–85). */
const CONFLICT_ANTAGONIST_SLIDER_MIN = 85;

/** When slider > 85 and any antagonist keyword matches — main plot vs user intent clash. */
const CONFLICT_ANTAGONIST_PENALTY = 100;

/** Per user spec: |sliderValue - 50| / 50 ∈ [0, 1]. */
export function sliderIntensity(sliderValue: number): number {
  return Math.abs(sliderValue - 50) / 50;
}

/** @deprecated Use sliderIntensity */
export function distanceFromCenter(sliderValue: number): number {
  return (sliderValue - 50) / 50;
}

const HIGH_INTENT_THRESHOLD = 70;
const LOW_INTENT_THRESHOLD = 30;

/** Softer penalty when the user wants “high” on an axis but TMDB has no matching vibe keywords (rank down, don’t erase). */
const MISSING_HIGH_VIBE_KEYWORD_PENALTY = 38;

/** Extreme intent: slider 100 with zero high-list hits is a strong mismatch. */
const MISSING_HIGH_VIBE_KEYWORD_PENALTY_SLIDER_100 = 60;

/** Fine-tuning after penalties — scaled by intensity × hit counts. */
const BONUS_PER_HIGH_HIT = 22;
const BONUS_PER_LOW_HIT = 18;
const SOFT_CONFLICT_START = 80;
const SOFT_CONFLICT_PENALTY_PER_HIT = 22;

export const ROMANCE_SUBPLOT_KEYWORDS = [
  'love interest',
  'star crossed lovers',
  'chemistry',
  'passion',
  'wedding',
] as const;

function normPhrase(s: string): string {
  return s.toLowerCase().replace(/-/g, ' ').trim();
}

function namesNormalized(movie: Movie): string[] {
  return (movie.keywordNames ?? []).map((n) => normPhrase(n));
}

function genreIdsForMovie(movie: Movie): number[] {
  if (movie.genreIds != null && movie.genreIds.length > 0) return movie.genreIds;
  return movie.genre.map((g) => GENRE_NAME_TO_ID[g]).filter((id): id is number => id != null);
}

/** Normalized TMDB keyword names for matching / audits. */
export function getNormalizedKeywordNames(movie: Movie): string[] {
  return namesNormalized(movie);
}

/** Count phrase hits against TMDB keyword names (substring, hyphen-insensitive). */
export function countExtremeKeywordHits(namesNorm: string[], phrases: readonly string[]): number {
  let hits = 0;
  for (const phrase of phrases) {
    const p = normPhrase(phrase);
    if (!p) continue;
    const matched = namesNorm.some((k) => k === p || k.includes(p) || p.includes(k));
    if (matched) hits += 1;
  }
  return hits;
}

/** Which library phrases matched (for audits / logging). */
export function listMatchedPhrases(namesNorm: string[], phrases: readonly string[]): string[] {
  const out: string[] = [];
  for (const phrase of phrases) {
    const p = normPhrase(phrase);
    if (!p) continue;
    const matched = namesNorm.some((k) => k === p || k.includes(p) || p.includes(k));
    if (matched) out.push(phrase);
  }
  return out;
}

export function getPrimaryGenre(movie: Movie): Genre | undefined {
  return movie.genre[0];
}

const ENERGY_AXIS_KEYS = ['pacing', 'cryMeter', 'humor', 'romance', 'suspense'] as const;

/**
 * @deprecated Always **true** — we no longer remove movies for missing vibe keywords; scoring handles rank only.
 */
export function moviePassesMaxEnergySlidersVibeGate(_movie: Movie, _filters: FilterState): boolean {
  return true;
}

export type EnergyAxisDetail = {
  axis: keyof typeof VIBE_EXTREME_MAP;
  sliderVal: number;
  intensity: number;
  highHits: number;
  lowHits: number;
  highIntent: boolean;
  lowIntent: boolean;
  /** Core plot: primary genre matches `SLIDER_ANCHOR_GENRE[axis]` when slider > 70. */
  anchorBonus: number;
  /** Core plot: any `VIBE_CONFLICT_MAP` protagonist phrase matched when slider > 70. */
  protagonistBonus: number;
  /** Core plot: antagonist matches when slider > 85 only. */
  antagonistConflictHits: number;
  antagonistConflictPenalty: number;
  /** Fine-tuning: `VIBE_EXTREME_MAP` nuke (e.g. −80). */
  metadataPenalty: number;
  /** Fine-tuning: intensity × keyword hits from `VIBE_EXTREME_MAP`. */
  metadataBonus: number;
  /** All penalties on this axis (metadata + antagonist). */
  penalty: number;
  /** All bonuses on this axis (anchor + protagonist + metadata). */
  bonus: number;
};

export type EnergyScoreResult = {
  /** Antagonist nukes only (≤ 0). */
  mainPlotPenalties: number;
  /** Anchor + protagonist (≥ 0). */
  mainPlotBonuses: number;
  /** VIBE_EXTREME nukes (≤ 0). */
  metadataPenalties: number;
  /** VIBE_EXTREME intensity bonuses (≥ 0). */
  metadataBonuses: number;
  /** mainPlotPenalties + metadataPenalties. */
  penalties: number;
  /** mainPlotBonuses + metadataBonuses. */
  bonuses: number;
  axes: EnergyAxisDetail[];
};

/**
 * Scoring hierarchy (additive):
 * 1. **Main plot** (`VIBE_CONFLICT_MAP`): slider > 70 → +60 anchor if primary genre matches; +40 if any protagonist
 *    phrase matches. Slider **> 85 only** → −100 if any antagonist phrase matches (off for 40–75 and 76–85).
 * 2. **Metadata** (`VIBE_EXTREME_MAP`): high/low intent nukes and intensity × hit bonuses.
 */
export function calculateEnergyScore(movie: Movie, filters: FilterState): EnergyScoreResult {
  const kw = namesNormalized(movie);
  const axes: EnergyAxisDetail[] = [];
  let mainPlotPenalties = 0;
  let mainPlotBonuses = 0;
  let metadataPenalties = 0;
  let metadataBonuses = 0;

  const primaryGenre = getPrimaryGenre(movie);

  const dims = [
    ['pacing', filters.pacing],
    ['cryMeter', filters.cryMeter],
    ['humor', filters.humor],
    ['romance', filters.romance],
    ['suspense', filters.suspense],
  ] as const;

  for (const [key, sliderVal] of dims) {
    const intensity = sliderIntensity(sliderVal);
    const { high, low } = VIBE_EXTREME_MAP[key];
    const highHits = countExtremeKeywordHits(kw, high);
    const lowHits = countExtremeKeywordHits(kw, low);
    const highIntent = sliderVal > HIGH_INTENT_THRESHOLD;
    const lowIntent = sliderVal < LOW_INTENT_THRESHOLD;

    let metadataPenalty = 0;
    let metadataBonus = 0;

    if (highIntent) {
      if (highHits === 0) {
        const miss =
          sliderVal === 100 ? MISSING_HIGH_VIBE_KEYWORD_PENALTY_SLIDER_100 : MISSING_HIGH_VIBE_KEYWORD_PENALTY;
        metadataPenalty -= miss;
      } else metadataBonus += intensity * BONUS_PER_HIGH_HIT * highHits;
    } else if (lowIntent) {
      /** User wants a “low” vibe but high-list keywords intrude — rank down, same spirit as missing-keyword miss. */
      if (highHits > 0) metadataPenalty -= MISSING_HIGH_VIBE_KEYWORD_PENALTY;
      else metadataBonus += intensity * BONUS_PER_LOW_HIT * lowHits;
    }

    /**
     * 80–99 "soft sink": conflicting primary genres are penalized but not removed.
     * At 100, Discover already applies conflict-map exclusion (except user-selected "User Wins" genres).
     */
    if (sliderVal >= SOFT_CONFLICT_START && sliderVal < 100) {
      const conflictGenreIds = GENRE_CONFLICT_MAP[key];
      const movieGenreIds = genreIdsForMovie(movie);
      const conflictHits = conflictGenreIds.filter((id) => movieGenreIds.includes(id)).length;
      if (conflictHits > 0) {
        metadataPenalty -= SOFT_CONFLICT_PENALTY_PER_HIT * conflictHits;
      }
    }

    let anchorBonus = 0;
    let protagonistBonus = 0;
    let antagonistConflictHits = 0;
    let antagonistConflictPenalty = 0;

    const pack = VIBE_CONFLICT_MAP[key as keyof typeof VIBE_CONFLICT_MAP];
    if (pack && highIntent) {
      const anchorGenre = SLIDER_ANCHOR_GENRE[key];
      if (primaryGenre != null && primaryGenre === anchorGenre) {
        anchorBonus = MAIN_PLOT_ANCHOR_BONUS;
      }
      if (countExtremeKeywordHits(kw, pack.protagonists) > 0) {
        protagonistBonus = MAIN_PLOT_PROTAGONIST_BONUS;
      }
    }

    /** Strictly > 85: integers 86–100 only (40–75 and 76–85 never get antagonist nuke). */
    if (pack && sliderVal > CONFLICT_ANTAGONIST_SLIDER_MIN) {
      antagonistConflictHits = countExtremeKeywordHits(kw, pack.antagonists);
      if (antagonistConflictHits > 0) {
        antagonistConflictPenalty = -CONFLICT_ANTAGONIST_PENALTY;
      }
    }

    mainPlotPenalties += antagonistConflictPenalty;
    mainPlotBonuses += anchorBonus + protagonistBonus;
    metadataPenalties += metadataPenalty;
    metadataBonuses += metadataBonus;

    const penalty = metadataPenalty + antagonistConflictPenalty;
    const bonus = anchorBonus + protagonistBonus + metadataBonus;

    axes.push({
      axis: key,
      sliderVal,
      intensity,
      highHits,
      lowHits,
      highIntent,
      lowIntent,
      anchorBonus,
      protagonistBonus,
      antagonistConflictHits,
      antagonistConflictPenalty,
      metadataPenalty,
      metadataBonus,
      penalty,
      bonus,
    });
  }

  return {
    mainPlotPenalties,
    mainPlotBonuses,
    metadataPenalties,
    metadataBonuses,
    penalties: mainPlotPenalties + metadataPenalties,
    bonuses: mainPlotBonuses + metadataBonuses,
    axes,
  };
}

/** @deprecated Alias: penalties + bonuses (used by match pipeline). */
export function scoreMovieVibeRaw(movie: Movie, filters: FilterState): number {
  const e = calculateEnergyScore(movie, filters);
  return e.penalties + e.bonuses;
}

export type MatchScoreBreakdown = {
  genreBase: number;
  mainPlotPenalties: number;
  mainPlotBonuses: number;
  metadataPenalties: number;
  metadataBonuses: number;
  /** Sum of energy penalties (main + metadata). */
  energyPenalties: number;
  /** Sum of energy bonuses (main + metadata). */
  energyBonuses: number;
  criticsFansComponent: number;
  /** genreBase + main plot + metadata + criticsFansComponent (before tie-break). */
  subtotal: number;
  axes: EnergyAxisDetail[];
};

/**
 * Pipeline: genre base → main plot (conflict map) → metadata (VIBE_EXTREME) → critics/fans (weighted).
 * `criticsFansComponent` is already scaled (see filterMovies CF_WEIGHT).
 */
export function calculateScore(
  movie: Movie,
  filters: FilterState,
  genreBase: number,
  criticsFansComponent: number
): MatchScoreBreakdown {
  const e = calculateEnergyScore(movie, filters);
  return {
    genreBase,
    mainPlotPenalties: e.mainPlotPenalties,
    mainPlotBonuses: e.mainPlotBonuses,
    metadataPenalties: e.metadataPenalties,
    metadataBonuses: e.metadataBonuses,
    energyPenalties: e.penalties,
    energyBonuses: e.bonuses,
    criticsFansComponent,
    subtotal: genreBase + e.penalties + e.bonuses + criticsFansComponent,
    axes: e.axes,
  };
}

/** Legacy blend helper (unused by default ranking). */
export const VIBE_MATCH_WEIGHT = 0.4;
export const GENRE_CF_MATCH_WEIGHT = 0.6;

export function blendMatchPercentage(
  normGenre: number,
  normCriticsFans: number,
  normVibe: number,
  weights?: { genreCf: number; vibe: number }
): number {
  const w = weights ?? { genreCf: GENRE_CF_MATCH_WEIGHT, vibe: VIBE_MATCH_WEIGHT };
  const genreCriticsFansBlend = 0.5 * normGenre + 0.5 * normCriticsFans;
  return w.genreCf * genreCriticsFansBlend + w.vibe * normVibe;
}
