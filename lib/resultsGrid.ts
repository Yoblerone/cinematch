import type { Movie, ResultsDisclaimer } from './types';

export type ResultsGridCell =
  | { type: 'movie'; movie: Movie; resultIndex: number }
  | { type: 'disclaimer' };

/** Interleaves the oops card immediately before `disclaimer.insertAt` in the movie list. */
export function buildResultsGrid(
  movies: Movie[],
  disclaimer: ResultsDisclaimer | null | undefined
): ResultsGridCell[] {
  const cells: ResultsGridCell[] = [];
  for (let i = 0; i < movies.length; i++) {
    if (disclaimer?.show && disclaimer.insertAt === i) {
      cells.push({ type: 'disclaimer' });
    }
    cells.push({ type: 'movie', movie: movies[i]!, resultIndex: i });
  }
  return cells;
}
