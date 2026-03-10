/**
 * TMDB movie IDs for Academy Award Best Picture winners.
 * Used to set oscarWinner: true when enriching from TMDB.
 * 58574 on TMDB is Sherlock Holmes: A Game of Shadows; The Artist (2011) is 74643.
 * Chicago (2002) is 1574; 424 is Schindler's List (1993).
 */
const OSCAR_BEST_PICTURE_TMDB_IDS = new Set<number>([
  872585,  // Oppenheimer (2023)
  496243,  // Parasite (2020)
  490132,  // Green Book (2019)
  399579,  // The Shape of Water (2018)
  376867,  // Moonlight (2016)
  314365,  // Spotlight (2015)
  194662,  // Birdman (2014)
  76203,   // 12 Years a Slave (2013)
  68721,   // Argo (2012)
  74643,   // The Artist (2011)
  46195,   // The King's Speech (2010)
  44214,   // The Hurt Locker (2009)
  12445,   // Slumdog Millionaire (2008)
  4347,    // No Country for Old Men (2007)
  4538,    // The Departed (2006)
  1422,    // Crash (2005)
  70,      // Million Dollar Baby (2004)
  322,     // The Lord of the Rings: The Return of the King (2003)
  1574,    // Chicago (2002)
  227159,  // A Beautiful Mind (2001)
  424694,  // Gladiator (2000)
  857,     // American Beauty (1999)
  14,      // Shakespeare in Love (1998)
  637,     // Titanic (1997)
  423,     // The English Patient (1996)
  8012,    // Braveheart (1995)
  424,     // Schindler's List (1993)
  9479,    // Unforgiven (1992)
  274,     // The Silence of the Lambs (1991)
  409,     // Dances with Wolves (1990)
  581,     // Driving Miss Daisy (1989)
  12102,   // Rain Man (1988)
  4248,    // The Last Emperor (1987)
  11886,   // Platoon (1986)
  238,     // The Godfather (1972)
  240,     // The Godfather Part II (1974)
]);

/** Best Picture nominees that did *not* win (winners are in OSCAR_BEST_PICTURE_TMDB_IDS). Expand as needed. */
const OSCAR_BEST_PICTURE_NOMINEE_ONLY_IDS = new Set<number>([
  313369,  // La La Land (2016)
  281338,  // The Revenant (2015)
  273248,  // The Hateful Eight (2015)
  // Add more nominee-only IDs from TMDB lists
]);

export function isOscarBestPictureWinner(tmdbMovieId: number): boolean {
  return OSCAR_BEST_PICTURE_TMDB_IDS.has(tmdbMovieId);
}

/** True if movie was nominated for Best Picture (winners count as nominees). */
export function isOscarBestPictureNominee(tmdbMovieId: number): boolean {
  return OSCAR_BEST_PICTURE_TMDB_IDS.has(tmdbMovieId) || OSCAR_BEST_PICTURE_NOMINEE_ONLY_IDS.has(tmdbMovieId);
}
