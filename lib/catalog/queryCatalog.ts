import type { SupabaseClient } from '@supabase/supabase-js';
import type { FilterState } from '@/lib/types';
import { GENRE_NAME_TO_ID } from '@/lib/tmdb';
import { resolveEraDiscoverDateBounds } from '@/lib/era';
import {
  CURATED_ORIGINAL_LANGUAGE_CODES,
  WORLD_CINEMA_FANOUT_LANGUAGE_CODES,
} from '@/lib/originalLanguage';
import type { CatalogMovieRow } from './catalogRow';

const CATALOG_POOL_LIMIT = 800;

function runtimeBounds(runtime: FilterState['runtime']): { gte?: number; lte?: number } {
  if (runtime === 'short') return { lte: 89 };
  if (runtime === 'medium') return { gte: 90, lte: 150 };
  if (runtime === 'long') return { gte: 151 };
  return {};
}

function voteFloors(filters: FilterState): { voteCountGte: number; voteAverageGte?: number } {
  let voteCountGte = 10;
  let voteAverageGte: number | undefined;
  if (filters.criticsVsFans === 'critics') {
    voteCountGte = 150;
    voteAverageGte = 7.5;
  } else if (filters.criticsVsFans === 'fans') {
    voteCountGte = 500;
  } else if (filters.criticsVsFans === 'both') {
    voteCountGte = 1000;
    voteAverageGte = 7.0;
  }
  if (filters.aListCast === 'low' || filters.directorProminence === 'low') {
    voteCountGte = Math.min(voteCountGte, 50);
    voteAverageGte = voteAverageGte ?? 6.5;
  }
  return { voteCountGte, voteAverageGte };
}

function orderColumn(filters: FilterState): { column: string; ascending: boolean } {
  if (filters.criticsVsFans === 'fans') {
    return { column: 'vote_count', ascending: false };
  }
  if (filters.decade.includes('new-releases')) {
    return { column: 'release_date', ascending: false };
  }
  return { column: 'vote_average', ascending: false };
}

export async function queryCatalogByTmdbIds(
  supabase: SupabaseClient,
  ids: number[]
): Promise<CatalogMovieRow[]> {
  if (ids.length === 0) return [];
  const chunkSize = 200;
  const rows: CatalogMovieRow[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { data, error } = await supabase.from('movies').select('*').in('tmdb_id', chunk);
    if (error) throw new Error(`Supabase catalog by ids: ${error.message}`);
    if (data?.length) rows.push(...(data as CatalogMovieRow[]));
  }
  return rows;
}

/** Primary catalog candidate pool for match (fast SQL filters + client genre AND). */
export async function queryCatalogCandidates(
  supabase: SupabaseClient,
  filters: FilterState
): Promise<CatalogMovieRow[]> {
  const { voteCountGte, voteAverageGte } = voteFloors(filters);
  const runtime = runtimeBounds(filters.runtime);
  const eraBounds = resolveEraDiscoverDateBounds(filters.decade);
  const order = orderColumn(filters);

  let q = supabase
    .from('movies')
    .select('*')
    .gte('vote_count', voteCountGte)
    .not('poster_path', 'is', null);

  if (voteAverageGte != null) q = q.gte('vote_average', voteAverageGte);
  if (runtime.gte != null) q = q.gte('runtime_minutes', runtime.gte);
  if (runtime.lte != null) q = q.lte('runtime_minutes', runtime.lte);
  if (eraBounds?.gte) q = q.gte('release_date', eraBounds.gte);
  if (eraBounds?.lte) q = q.lte('release_date', eraBounds.lte);

  const lang = filters.originalLanguage;
  if (lang != null && lang !== 'world-cinema' && CURATED_ORIGINAL_LANGUAGE_CODES.includes(lang)) {
    q = q.eq('original_language', lang);
  } else if (lang === 'world-cinema') {
    q = q.in('original_language', [...WORLD_CINEMA_FANOUT_LANGUAGE_CODES]);
  }

  const genreIds = filters.genre
    .map((g) => GENRE_NAME_TO_ID[g])
    .filter((id): id is number => id != null);
  if (genreIds.length === 1) {
    q = q.contains('genre_ids', [genreIds[0]!]);
  } else if (genreIds.length > 1) {
    q = q.overlaps('genre_ids', genreIds);
  }

  q = q.order(order.column, { ascending: order.ascending }).limit(CATALOG_POOL_LIMIT);

  const { data, error } = await q;
  if (error) throw new Error(`Supabase catalog query: ${error.message}`);

  let rows = (data ?? []) as CatalogMovieRow[];

  if (genreIds.length > 1) {
    rows = rows.filter((row) => {
      const ids = row.genre_ids ?? [];
      return genreIds.every((gid) => ids.includes(gid));
    });
  }

  if (filters.aListCast === 'high') {
    rows = rows.filter((r) => (r.vote_count ?? 0) >= 5000);
  }
  if (filters.aListCast === 'low' || filters.directorProminence === 'low') {
    rows = rows.filter((r) => (r.vote_count ?? 0) <= 8000);
  }
  if (filters.directorProminence === 'high') {
    rows = rows.filter((r) => (r.vote_count ?? 0) >= 500);
  }

  return rows;
}
