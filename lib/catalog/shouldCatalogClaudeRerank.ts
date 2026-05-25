import type { FilterState } from '@/lib/types';
import { catalogHasActiveEnergyAxis } from './catalogMovieScore';

/**
 * One Anthropic call per match when true. Skips bare single-genre browse (local ranking only)
 * unless CATALOG_CLAUDE_ALWAYS=1.
 */
export function shouldCatalogClaudeRerank(filters: FilterState): boolean {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) return false;
  const flag = (process.env.CATALOG_CLAUDE_RERANK ?? '1').toLowerCase();
  if (flag === '0' || flag === 'false' || flag === 'off') return false;

  if (process.env.CATALOG_CLAUDE_ALWAYS === '1') return true;

  return (
    catalogHasActiveEnergyAxis(filters) ||
    filters.genre.length >= 2 ||
    filters.decade.length > 0 ||
    filters.runtime != null ||
    filters.aListCast != null ||
    filters.directorProminence != null ||
    filters.criticsVsFans != null ||
    filters.oscarFilter != null
  );
}
