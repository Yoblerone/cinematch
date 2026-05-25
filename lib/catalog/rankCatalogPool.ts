import type { FilterState, Movie } from '@/lib/types';
import { hardMatchCount, moviePassesStrictGrid } from '@/lib/matchFinalize';
import { catalogHasActiveEnergyAxis, scoreCatalogMovie } from './catalogMovieScore';

const PRESENTATION_POOL_MAX = 240;

/**
 * Score full catalog pool without hard-deleting rows — `finalizeMatchPresentation` splits
 * strict vs next-best and inserts the oops card when strict &lt; 36.
 */
export function buildCatalogPresentationPool(movies: Movie[], filters: FilterState): Movie[] {
  const energyActive = catalogHasActiveEnergyAxis(filters);

  const scored = movies.map((movie, rank) => {
    const { thematic, totalScore } = scoreCatalogMovie(movie, filters);
    const zeroThematic = energyActive && thematic.density_score <= 0.5;

    return {
      movie,
      rank,
      totalScore,
      zeroThematic,
      passesGate: thematic.passesGate,
      strict: moviePassesStrictGrid(movie, filters),
      matchCount: hardMatchCount(movie, filters),
      vibeDensity: thematic.density_score,
    };
  });

  scored.sort((a, b) => {
    if (a.strict !== b.strict) return a.strict ? -1 : 1;
    if (energyActive && a.passesGate !== b.passesGate) return a.passesGate ? -1 : 1;
    if (energyActive && a.zeroThematic !== b.zeroThematic) return a.zeroThematic ? 1 : -1;
    if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
    if (energyActive && Math.abs(b.vibeDensity - a.vibeDensity) > 0.01) {
      return b.vibeDensity - a.vibeDensity;
    }
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return a.rank - b.rank;
  });

  return scored.slice(0, PRESENTATION_POOL_MAX).map((s) => {
    const m = s.movie;
    m.finalMatchScore = s.totalScore;
    m.matchPercentage = Math.max(0, Math.min(100, Math.round(s.totalScore / 8)));
    m.vibeDensityScore = s.vibeDensity;
    return m;
  });
}
