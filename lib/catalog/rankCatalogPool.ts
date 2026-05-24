import type { FilterState, Movie } from '@/lib/types';
import { combinedTopRatedMatchScore } from '@/lib/criticsFansRank';
import { scoreMovieDeclarative } from '@/lib/scoring/thematicEngine';
import { GENRE_NAME_TO_ID } from '@/lib/tmdb';
import { prestigeDirectorMatch } from '@/lib/prestigeScore';
import { PROMINENCE_TRUTH_LIST } from '@/lib/prominence';
import { isOscarListedId, isOscarNomineeId, isOscarWinnerId } from '@/lib/data/oscar-truth';
import { parseTmdbMovieId } from '@/lib/tmdb';
import { hardMatchCount, moviePassesStrictGrid } from '@/lib/matchFinalize';

const PRESENTATION_POOL_MAX = 240;

function calculatePedigreeBoost(movie: Movie, filters: FilterState): number {
  let score = 0;
  if (filters.oscarFilter != null) {
    const id = parseTmdbMovieId(movie.id);
    if (filters.oscarFilter === 'winner') score += isOscarWinnerId(id) ? 20 : 0;
    else if (filters.oscarFilter === 'nominee') score += isOscarNomineeId(id) ? 20 : 0;
    else score += isOscarListedId(id) ? 20 : 0;
  }
  if (filters.directorProminence != null) {
    const dirSlider = filters.directorProminence === 'high' ? 90 : 10;
    const dirMatch = prestigeDirectorMatch(movie, dirSlider, PROMINENCE_TRUTH_LIST);
    score += (dirMatch - 50) * 4;
  }
  if (filters.criticsVsFans === 'both') {
    const topRatedScore = combinedTopRatedMatchScore(movie);
    score += (topRatedScore - 50) * 2;
  }
  return score;
}

/**
 * Score full catalog pool without hard-deleting rows — `finalizeMatchPresentation` splits
 * strict vs next-best and inserts the oops card when strict &lt; 36.
 */
export function buildCatalogPresentationPool(movies: Movie[], filters: FilterState): Movie[] {
  const activeGenres = filters.genre;

  const scored = movies.map((movie, rank) => {
    const baseScore = scoreMovieDeclarative(movie, filters);
    const selectedGenreIds = activeGenres
      .map((g) => GENRE_NAME_TO_ID[g])
      .filter((id): id is number => id != null);
    const genreIds = movie.genreIds ?? [];
    const primaryGenreMatchBoost =
      selectedGenreIds.length > 0
        ? selectedGenreIds.reduce((acc, gid) => {
            if (genreIds[0] === gid) return acc + 400;
            if (genreIds.includes(gid)) return acc + 20;
            return acc - 400;
          }, 0)
        : 0;
    const pedigreeBoost = calculatePedigreeBoost(movie, filters);
    const qualityBuffer = (movie.rating ?? 0) * 5;
    const totalScore =
      qualityBuffer + primaryGenreMatchBoost + pedigreeBoost + baseScore.finalVibeScore * 0.2;

    return {
      movie,
      rank,
      totalScore,
      strict: moviePassesStrictGrid(movie, filters),
      matchCount: hardMatchCount(movie, filters),
    };
  });

  scored.sort((a, b) => {
    if (a.strict !== b.strict) return a.strict ? -1 : 1;
    if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return a.rank - b.rank;
  });

  return scored.slice(0, PRESENTATION_POOL_MAX).map((s) => {
    const m = s.movie;
    m.finalMatchScore = s.totalScore;
    m.matchPercentage = Math.max(0, Math.min(100, Math.round(s.totalScore / 8)));
    return m;
  });
}
