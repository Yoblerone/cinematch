/**
 * Best Picture nominees truth list — same as winners: no TMDB API for the list.
 * When "Best Picture Nominee" filter is selected, the app uses ONLY this file.
 * List = all Best Picture nominees (including winners) by year, from academyAwardData.
 */

import type { Movie } from './types';
import { ACADEMY_AWARD_DATA } from './academyAwardData';
import type { AcademyAwardEntry } from './academyAwardData';
import { BEST_PICTURE_POSTER_PATHS } from './bestPicturePosters.data';

/** All Best Picture nominees as Movie[] from truth data only — no API. Newest (2024) to oldest. */
export function getBestPictureNomineesAsMovies(): Movie[] {
  const ordered = [...ACADEMY_AWARD_DATA].sort((a, b) => b.year - a.year);
  return ordered.map((entry) => nomineeEntryToMovie(entry));
}

function nomineeEntryToMovie(entry: AcademyAwardEntry): Movie {
  return {
    id: `tmdb-${entry.id}`,
    title: entry.title,
    year: entry.year,
    tagline: '',
    posterColor: 'from-cherry-900 to-cherry-950',
    posterPath: BEST_PICTURE_POSTER_PATHS[entry.id] ?? null,
    crowd: [],
    pacing: 50,
    intensity: 50,
    cryMeter: 50,
    humor: 50,
    romance: 50,
    suspense: 50,
    genre: [],
    theme: [],
    visualStyle: [],
    soundtrack: [],
    boxOffice: 0,
    budget: 0,
    rating: 0,
    hasAListCast: false,
    criticsVsFans: 'both',
    oscarWinner: entry.type === 'Winner',
    oscarNominee: true,
    academyAwardYear: entry.year,
    academyAwardType: entry.type,
    runtimeMinutes: 0,
    directorProminence: 0,
  };
}
