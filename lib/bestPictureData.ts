/**
 * Strict Best Picture (Academy Award) winner list — truth data only.
 * When "Best Picture Winner" filter is selected, the app uses ONLY this file (no TMDB API).
 */

import type { Movie } from './types';
import { BEST_PICTURE_POSTER_PATHS } from './bestPicturePosters.data';

export interface BestPictureWinnerEntry {
  id: number;
  title: string;
  year: number;
}

/** The truth list: only these IDs (and years) are ever shown as Best Picture winners. */
export const BEST_PICTURE_WINNERS: BestPictureWinnerEntry[] = [
  { id: 1011985, title: "Anora", year: 2024 },
  { id: 872585, title: "Oppenheimer", year: 2023 },
  { id: 545611, title: "Everything Everywhere All at Once", year: 2022 },
  { id: 568124, title: "CODA", year: 2021 },
  { id: 581734, title: "Nomadland", year: 2020 },
  { id: 496243, title: "Parasite", year: 2019 },
  { id: 490132, title: "Green Book", year: 2018 },
  { id: 399055, title: "The Shape of Water", year: 2017 },
  { id: 376867, title: "Moonlight", year: 2016 },
  { id: 308357, title: "Spotlight", year: 2015 },
  { id: 235271, title: "Birdman", year: 2014 },
  { id: 76721, title: "12 Years a Slave", year: 2013 },
  { id: 82690, title: "Argo", year: 2012 },
  { id: 70868, title: "The Artist", year: 2011 },
  { id: 45269, title: "The King's Speech", year: 2010 },
  { id: 17749, title: "The Hurt Locker", year: 2009 },
  { id: 12405, title: "Slumdog Millionaire", year: 2008 },
  { id: 1402, title: "No Country for Old Men", year: 2007 },
  { id: 1422, title: "The Departed", year: 2006 },
  { id: 11130, title: "Crash", year: 2005 },
  { id: 8710, title: "Million Dollar Baby", year: 2004 },
  { id: 122, title: "The Lord of the Rings: The Return of the King", year: 2003 },
  { id: 1532, title: "Chicago", year: 2002 },
  { id: 453, title: "A Beautiful Mind", year: 2001 },
  { id: 98, title: "Gladiator", year: 2000 },
  { id: 14, title: "American Beauty", year: 1999 },
  { id: 1934, title: "Shakespeare in Love", year: 1998 },
  { id: 597, title: "Titanic", year: 1997 },
  { id: 409, title: "The English Patient", year: 1996 },
  { id: 9659, title: "Braveheart", year: 1995 },
  { id: 13, title: "Forrest Gump", year: 1994 },
];

const byId = new Map<number, BestPictureWinnerEntry>();
for (const entry of BEST_PICTURE_WINNERS) {
  byId.set(entry.id, entry);
}

/** IDs in descending year order (newest first). Use for Best Picture Winner filter only. */
export function getBestPictureWinnerIds(): number[] {
  return [...BEST_PICTURE_WINNERS]
    .sort((a, b) => b.year - a.year)
    .map((e) => e.id);
}

export function isBestPictureWinner(tmdbMovieId: number): boolean {
  return byId.has(tmdbMovieId);
}

export function getBestPictureAwardYear(tmdbMovieId: number): number | null {
  return byId.get(tmdbMovieId)?.year ?? null;
}

/** Best Picture winners as Movie[] from truth data only — no API. Order: newest (2024) to oldest (1994). */
export function getBestPictureWinnersAsMovies(): Movie[] {
  const ordered = [...BEST_PICTURE_WINNERS].sort((a, b) => b.year - a.year);
  return ordered.map((entry) => truthEntryToMovie(entry));
}

function truthEntryToMovie(entry: BestPictureWinnerEntry): Movie {
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
    oscarWinner: true,
    oscarNominee: true,
    academyAwardYear: entry.year,
    academyAwardType: 'Winner',
    runtimeMinutes: 0,
    directorProminence: 0,
  };
}
