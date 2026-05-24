import type { FilterState, Movie } from '@/lib/types';
import { filterMovies } from '@/lib/filterMovies';
import { combinedTopRatedMatchScore } from '@/lib/criticsFansRank';
import { scoreMovieDeclarative } from '@/lib/scoring/thematicEngine';
import { GENRE_NAME_TO_ID } from '@/lib/tmdb';
import { movieHasAllSelectedGenres } from '@/lib/filterMovies';
import { prestigeDirectorMatch } from '@/lib/prestigeScore';
import { PROMINENCE_TRUTH_LIST } from '@/lib/prominence';
import { isOscarListedId, isOscarNomineeId, isOscarWinnerId } from '@/lib/data/oscar-truth';
import { parseTmdbMovieId } from '@/lib/tmdb';

const DEEP_POOL_MAX = 120;

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

/** Score, trim, and attach match % — mirrors core of TMDB deep pool ranking. */
export function rankCatalogPool(movies: Movie[], filters: FilterState): Movie[] {
  const filtered = filterMovies(movies, filters, { skipMaxSliderVibeTrim: true });
  const activeGenres = filters.genre;

  const scored = filtered.map((movie) => {
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

    return { movie, totalScore, baseScore };
  });

  scored.sort((a, b) => b.totalScore - a.totalScore);

  const top = scored
    .filter((s) =>
      activeGenres.length === 0 ? true : movieHasAllSelectedGenres(s.movie, filters)
    )
    .slice(0, DEEP_POOL_MAX);

  return top.map((s, i) => {
    const m = s.movie;
    m.finalMatchScore = s.totalScore;
    m.matchPercentage = Math.max(0, Math.min(100, Math.round(s.totalScore / 8)));
    m.vibeDensityScore = s.baseScore.baseVibeScore;
    return m;
  });
}
