import type { FilterState, TmdbMatchResponse } from './types';
import { getSupabaseAdmin } from './supabaseServer';
import { getTmdbMatches } from './tmdbEnrich';
import { finalizeMatchPresentation } from './matchFinalize';
import { mapCatalogRowToMovie } from './catalog/mapCatalogRow';
import { queryCatalogByTmdbIds, queryCatalogCandidates } from './catalog/queryCatalog';
import { rankCatalogPool } from './catalog/rankCatalogPool';
import {
  getOscarBothIds,
  getOscarNomineeIds,
  getOscarWinnerIds,
} from './data/oscar-truth';

type MatchOptions = { discoverStartPage?: number };

async function getCatalogMatches(filters: FilterState): Promise<TmdbMatchResponse> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (or Vercel env).'
    );
  }

  let rows;
  const oscar = filters.oscarFilter;
  if (oscar === 'winner') {
    rows = await queryCatalogByTmdbIds(supabase, getOscarWinnerIds());
  } else if (oscar === 'nominee') {
    rows = await queryCatalogByTmdbIds(supabase, getOscarNomineeIds());
  } else if (oscar === 'both') {
    rows = await queryCatalogByTmdbIds(supabase, getOscarBothIds());
  } else {
    rows = await queryCatalogCandidates(supabase, filters);
  }

  const movies = rows.map(mapCatalogRowToMovie);
  const ranked = rankCatalogPool(movies, filters);

  console.log('[match] catalog', {
    catalogRowCount: rows.length,
    rankedCount: ranked.length,
  });

  return finalizeMatchPresentation(ranked, filters);
}

/**
 * Match from Supabase catalog (default). Set MATCH_SOURCE=tmdb to use live TMDB discover/enrich.
 */
export async function getHybridMatches(
  tmdbApiKey: string,
  filters: FilterState,
  options?: MatchOptions
): Promise<TmdbMatchResponse> {
  const mode = (process.env.MATCH_SOURCE ?? 'supabase').toLowerCase();
  if (mode === 'tmdb') {
    if (!tmdbApiKey?.trim()) {
      throw new Error('TMDB_API_KEY is required when MATCH_SOURCE=tmdb');
    }
    return getTmdbMatches(tmdbApiKey, filters, options);
  }

  return getCatalogMatches(filters);
}
