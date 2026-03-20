/**
 * Academy Awards (Best Picture) helpers.
 * Delegates to the VIP list in academyAwardData.ts.
 */

import {
  getWinnerIds,
  getNomineeIds,
  getBothIds,
  isWinner,
  isNominee,
  isBoth,
} from './academyAwardData';

export function isOscarBestPictureWinner(tmdbMovieId: number): boolean {
  return isWinner(tmdbMovieId);
}

export function isOscarBestPictureNominee(tmdbMovieId: number): boolean {
  return isNominee(tmdbMovieId);
}

export function isOscarBestPictureBoth(tmdbMovieId: number): boolean {
  return isBoth(tmdbMovieId);
}

export function getOscarBestPictureWinnerIds(): number[] {
  return getWinnerIds();
}

export function getOscarBestPictureNomineeIds(): number[] {
  return getNomineeIds();
}

export function getOscarBestPictureBothIds(): number[] {
  return getBothIds();
}

export { getAwardInfo } from './academyAwardData';
