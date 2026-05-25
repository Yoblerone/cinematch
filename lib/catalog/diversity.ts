import type { Movie } from '@/lib/types';

/** One title per TMDB collection in ranked order (catalog + TMDB paths). */
export function applyFranchiseDiversityCap(movies: Movie[]): Movie[] {
  const seenCollections = new Set<number>();
  return movies.filter((m) => {
    if (!m.collectionId) return true;
    if (seenCollections.has(m.collectionId)) return false;
    seenCollections.add(m.collectionId);
    return true;
  });
}
