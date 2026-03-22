import type { FilterState, Movie } from './types';
import truthListJson from './data/truth-list.json';
import { prestigeCastMatch, prestigeDirectorMatch } from './prestigeScore';

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

/**
 * Cast + director “Prestige” fit (0–100 each): filmography depth, truth-list icons, billing order.
 * Mixes **Fresh Faces** (low slider, <5 major credits) vs **Icons** (high slider, deep credits + billing).
 */
export function calculateProminenceScore(
  movie: Movie,
  sliders: { cast: number; director: number },
  truthList: ProminenceTruthList = PROMINENCE_TRUTH_LIST
): { castMatch: number; directorMatch: number } {
  return {
    castMatch: prestigeCastMatch(movie, sliders.cast, truthList),
    directorMatch: prestigeDirectorMatch(movie, sliders.director, truthList),
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
  const wCast = filters.aListCastAny ? 0 : 1;
  const wDir = filters.directorProminenceAny ? 0 : 1;
  const sum = wCast + wDir;
  if (sum === 0) return 50;
  return (wCast * castMatch + wDir * directorMatch) / sum;
}
