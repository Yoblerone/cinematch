/**
 * Academy Awards (Best Picture) VIP list.
 * Single source of truth for Winner/Nominee filters and award labels.
 * IDs are used to fetch poster and details from TMDB API.
 */

export type AcademyAwardType = 'Winner' | 'Nominee';

export interface AcademyAwardEntry {
  id: number;
  title: string;
  year: number;
  type: AcademyAwardType;
}

export const ACADEMY_AWARD_DATA: AcademyAwardEntry[] = [
  // 2024 (Most Recent)
  { id: 1011985, title: 'Anora', year: 2024, type: 'Winner' },
  { id: 1064213, title: 'The Brutalist', year: 2024, type: 'Nominee' },
  { id: 933260, title: 'The Substance', year: 2024, type: 'Nominee' },
  { id: 915935, title: 'Emilia Pérez', year: 2024, type: 'Nominee' },
  { id: 402431, title: 'Wicked', year: 2024, type: 'Nominee' },
  { id: 693134, title: 'Dune: Part Two', year: 2024, type: 'Nominee' },
  { id: 1035048, title: 'Conclave', year: 2024, type: 'Nominee' },
  { id: 1005331, title: 'A Complete Unknown', year: 2024, type: 'Nominee' },
  { id: 981577, title: 'A Real Pain', year: 2024, type: 'Nominee' },
  { id: 1100782, title: 'Nickel Boys', year: 2024, type: 'Nominee' },

  // 2023
  { id: 872585, title: 'Oppenheimer', year: 2023, type: 'Winner' },
  { id: 792307, title: 'Poor Things', year: 2023, type: 'Nominee' },
  { id: 466420, title: 'Killers of the Flower Moon', year: 2023, type: 'Nominee' },
  { id: 346698, title: 'Barbie', year: 2023, type: 'Nominee' },
  { id: 921636, title: 'American Fiction', year: 2023, type: 'Nominee' },
  { id: 906126, title: 'Anatomy of a Fall', year: 2023, type: 'Nominee' },
  { id: 840430, title: 'The Holdovers', year: 2023, type: 'Nominee' },
  { id: 937249, title: 'Maestro', year: 2023, type: 'Nominee' },
  { id: 967847, title: 'Past Lives', year: 2023, type: 'Nominee' },

  // 2022
  { id: 545611, title: 'Everything Everywhere All at Once', year: 2022, type: 'Winner' },
  { id: 361743, title: 'Top Gun: Maverick', year: 2022, type: 'Nominee' },
  { id: 667538, title: 'The Banshees of Inisherin', year: 2022, type: 'Nominee' },
  { id: 49046, title: 'All Quiet on the Western Front', year: 2022, type: 'Nominee' },
  { id: 76600, title: 'Avatar: The Way of Water', year: 2022, type: 'Nominee' },
  { id: 705996, title: 'Elvis', year: 2022, type: 'Nominee' },
  { id: 804095, title: 'The Fabelmans', year: 2022, type: 'Nominee' },
  { id: 928544, title: 'Tár', year: 2022, type: 'Nominee' },

  // 2021
  { id: 568124, title: 'CODA', year: 2021, type: 'Winner' },
  { id: 438631, title: 'Dune', year: 2021, type: 'Nominee' },
  { id: 585083, title: 'West Side Story', year: 2021, type: 'Nominee' },
  { id: 644495, title: 'Drive My Car', year: 2021, type: 'Nominee' },
  { id: 70160, title: 'The Power of the Dog', year: 2021, type: 'Nominee' },

  // Historical Winners (1994-2020)
  { id: 581734, title: 'Nomadland', year: 2020, type: 'Winner' },
  { id: 496243, title: 'Parasite', year: 2019, type: 'Winner' },
  { id: 490132, title: 'Green Book', year: 2018, type: 'Winner' },
  { id: 399579, title: 'The Shape of Water', year: 2017, type: 'Winner' },
  { id: 376867, title: 'Moonlight', year: 2016, type: 'Winner' },
  { id: 314365, title: 'Spotlight', year: 2015, type: 'Winner' },
  { id: 194662, title: 'Birdman', year: 2014, type: 'Winner' },
  { id: 76203, title: '12 Years a Slave', year: 2013, type: 'Winner' },
  { id: 68721, title: 'Argo', year: 2012, type: 'Winner' },
  { id: 74643, title: 'The Artist', year: 2011, type: 'Winner' },
  { id: 46195, title: "The King's Speech", year: 2010, type: 'Winner' },
  { id: 44214, title: 'The Hurt Locker', year: 2009, type: 'Winner' },
  { id: 12445, title: 'Slumdog Millionaire', year: 2008, type: 'Winner' },
  { id: 4347, title: 'No Country for Old Men', year: 2007, type: 'Winner' },
  { id: 4538, title: 'The Departed', year: 2006, type: 'Winner' },
  { id: 1422, title: 'Crash', year: 2005, type: 'Winner' },
  { id: 70, title: 'Million Dollar Baby', year: 2004, type: 'Winner' },
  { id: 322, title: 'The Lord of the Rings: The Return of the King', year: 2003, type: 'Winner' },
  { id: 1574, title: 'Chicago', year: 2002, type: 'Winner' },
  { id: 227159, title: 'A Beautiful Mind', year: 2001, type: 'Winner' },
  { id: 424694, title: 'Gladiator', year: 2000, type: 'Winner' },
  { id: 857, title: 'American Beauty', year: 1999, type: 'Winner' },
  { id: 14, title: "Shakespeare in Love", year: 1998, type: 'Winner' },
  { id: 637, title: 'Titanic', year: 1997, type: 'Winner' },
  { id: 423, title: 'The English Patient', year: 1996, type: 'Winner' },
  { id: 8012, title: 'Braveheart', year: 1995, type: 'Winner' },
  { id: 13, title: 'Forrest Gump', year: 1994, type: 'Winner' },
];

const byId = new Map<number, AcademyAwardEntry>();
const winnerIds: number[] = [];
const nomineeOnlyIds: number[] = [];
const bothIds: number[] = [];

for (const entry of ACADEMY_AWARD_DATA) {
  byId.set(entry.id, entry);
  if (entry.type === 'Winner') winnerIds.push(entry.id);
  if (entry.type === 'Nominee') nomineeOnlyIds.push(entry.id);
  bothIds.push(entry.id);
}

// Sort by year descending (newest first)
winnerIds.sort((a, b) => (byId.get(b)!.year - byId.get(a)!.year));
nomineeOnlyIds.sort((a, b) => (byId.get(b)!.year - byId.get(a)!.year));
bothIds.sort((a, b) => (byId.get(b)!.year - byId.get(a)!.year));

/** Winner filter: only movies where type is 'Winner'. Order: newest (2024) to oldest. */
export function getWinnerIds(): number[] {
  return [...winnerIds];
}

/** Nominee-only filter: nominees excluding winners. Order: newest to oldest. */
export function getNomineeIds(): number[] {
  return [...nomineeOnlyIds];
}

/** Both filter: winners + nominees. Order: newest to oldest. */
export function getBothIds(): number[] {
  return [...bothIds];
}

export function isWinner(tmdbMovieId: number): boolean {
  return byId.get(tmdbMovieId)?.type === 'Winner';
}

export function isNominee(tmdbMovieId: number): boolean {
  return byId.get(tmdbMovieId)?.type === 'Nominee';
}

export function isBoth(tmdbMovieId: number): boolean {
  return byId.has(tmdbMovieId);
}

export function getAwardInfo(tmdbMovieId: number): { year: number; type: AcademyAwardType } | null {
  const entry = byId.get(tmdbMovieId);
  return entry ? { year: entry.year, type: entry.type } : null;
}
