import type { SupabaseClient } from '@supabase/supabase-js';
import type { FilterState } from '@/lib/types';
import { GENRE_NAME_TO_ID } from '@/lib/tmdb';
import { resolveEraDiscoverDateBounds } from '@/lib/era';
import {
  CURATED_ORIGINAL_LANGUAGE_CODES,
  WORLD_CINEMA_FANOUT_LANGUAGE_CODES,
} from '@/lib/originalLanguage';
import type { CatalogMovieRow } from './catalogRow';
import { catalogHasActiveEnergyAxis } from './catalogMovieScore';
import {
  activeManifestKeywordIds,
  catalogHasManifestProbe,
  catalogPoolOffset,
} from './manifestProbe';

const SLICE_LIMIT = 320;
const KEYWORD_PROBE_LIMIT = 260;
const BROAD_POOL_TRIGGER = 120;

function hasActiveEnergyAxis(filters: FilterState): boolean {
  return catalogHasActiveEnergyAxis(filters);
}

export type CatalogOrderBy = 'popularity' | 'vote_average' | 'vote_count' | 'release_date';

export type CatalogQueryOptions = {
  /** `and` = every selected genre required (strict). `or` = any selected genre (relaxed top-up). */
  genreJoinMode?: 'and' | 'or';
  orderBy?: CatalogOrderBy;
  /** Window into the ordered catalog (filter-hash offset for variety). */
  range?: { from: number; to: number };
  /** When set, require overlap with these TMDB keyword ids (catalog `keyword_ids`). */
  manifestKeywordIds?: number[];
};

function runtimeBounds(runtime: FilterState['runtime']): { gte?: number; lte?: number } {
  if (runtime === 'short') return { lte: 89 };
  if (runtime === 'medium') return { gte: 90, lte: 150 };
  if (runtime === 'long') return { gte: 151 };
  return {};
}

function voteFloors(filters: FilterState): { voteCountGte: number; voteAverageGte?: number } {
  let voteCountGte = 10;
  let voteAverageGte: number | undefined;
  if (filters.genre.length > 0) {
    voteCountGte = Math.max(voteCountGte, 80);
  }
  if (hasActiveEnergyAxis(filters)) {
    voteCountGte = Math.max(voteCountGte, 300);
    voteAverageGte = voteAverageGte ?? 6.0;
  }
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

function defaultOrderBy(filters: FilterState): CatalogOrderBy {
  if (filters.criticsVsFans === 'fans') return 'vote_count';
  if (filters.decade.includes('new-releases')) return 'release_date';
  if (hasActiveEnergyAxis(filters)) return 'popularity';
  return 'vote_average';
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

function dedupeRows(rows: CatalogMovieRow[]): CatalogMovieRow[] {
  const byId = new Map<number, CatalogMovieRow>();
  for (const row of rows) {
    byId.set(row.tmdb_id, row);
  }
  return Array.from(byId.values());
}

/** Primary catalog candidate pool for match (fast SQL filters + optional genre AND). */
export async function queryCatalogCandidates(
  supabase: SupabaseClient,
  filters: FilterState,
  options?: CatalogQueryOptions
): Promise<CatalogMovieRow[]> {
  const genreJoinMode = options?.genreJoinMode ?? (filters.genre.length > 1 ? 'and' : 'and');
  const { voteCountGte, voteAverageGte } = voteFloors(filters);
  const runtime = runtimeBounds(filters.runtime);
  const eraBounds = resolveEraDiscoverDateBounds(filters.decade);
  const orderBy = options?.orderBy ?? defaultOrderBy(filters);

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

  const manifestKw = options?.manifestKeywordIds;
  if (manifestKw != null && manifestKw.length > 0) {
    q = q.overlaps('keyword_ids', manifestKw);
  }

  q = q.order(orderBy, { ascending: false });
  if (options?.range) {
    q = q.range(options.range.from, options.range.to);
  } else {
    q = q.limit(SLICE_LIMIT);
  }

  const { data, error } = await q;
  if (error) throw new Error(`Supabase catalog query: ${error.message}`);

  let rows = (data ?? []) as CatalogMovieRow[];

  if (genreJoinMode === 'and' && genreIds.length > 1) {
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

/**
 * Strict SQL pool first; if thin (common with multi-genre AND), merge a genre-OR broadened pass
 * so finalize can show strict matches + oops card + next-best fill to 36.
 */
export async function fetchCatalogPool(
  supabase: SupabaseClient,
  filters: FilterState
): Promise<CatalogMovieRow[]> {
  const offset = catalogPoolOffset(filters);
  const manifestIds = activeManifestKeywordIds(filters);
  const primaryOrder = defaultOrderBy(filters);

  const slices: Promise<CatalogMovieRow[]>[] = [
    queryCatalogCandidates(supabase, filters, {
      genreJoinMode: 'and',
      orderBy: primaryOrder,
      range: { from: offset, to: offset + SLICE_LIMIT - 1 },
    }),
  ];

  if (catalogHasManifestProbe(filters)) {
    slices.push(
      queryCatalogCandidates(supabase, filters, {
        genreJoinMode: filters.genre.length > 1 ? 'or' : 'and',
        orderBy: 'release_date',
        manifestKeywordIds: manifestIds,
        range: { from: 0, to: KEYWORD_PROBE_LIMIT - 1 },
      })
    );
  }

  if (hasActiveEnergyAxis(filters)) {
    slices.push(
      queryCatalogCandidates(supabase, filters, {
        genreJoinMode: filters.genre.length > 1 ? 'or' : 'and',
        orderBy: 'vote_count',
        range: { from: 0, to: 199 },
      })
    );
  }

  let combined = dedupeRows((await Promise.all(slices)).flat());

  if (filters.genre.length > 1 && combined.length < BROAD_POOL_TRIGGER) {
    const broad = await queryCatalogCandidates(supabase, filters, {
      genreJoinMode: 'or',
      orderBy: primaryOrder,
      range: { from: (offset + 90) % 300, to: (offset + 90) % 300 + SLICE_LIMIT - 1 },
    });
    combined = dedupeRows([...combined, ...broad]);
  }

  if (combined.length < BROAD_POOL_TRIGGER) {
    if (filters.genre.length === 0) {
      const eraOnly: FilterState = {
        ...filters,
        narrative_pacing: null,
        emotional_tone: null,
        brain_power: null,
        visual_style: null,
        suspense_level: null,
        world_style: null,
        pacing: null,
        cryMeter: null,
        humor: null,
        romance: null,
        suspense: null,
        intensity: null,
        aListCast: null,
        directorProminence: null,
        criticsVsFans: null,
      };
      const eraTopUp = await queryCatalogCandidates(supabase, eraOnly, {
        genreJoinMode: 'or',
        orderBy: 'release_date',
        range: { from: offset, to: offset + SLICE_LIMIT - 1 },
      });
      combined = dedupeRows([...combined, ...eraTopUp]);
    } else if (filters.genre.length === 1) {
      const broad = await queryCatalogCandidates(supabase, filters, {
        genreJoinMode: 'or',
        orderBy: primaryOrder,
        range: { from: offset, to: offset + SLICE_LIMIT - 1 },
      });
      combined = dedupeRows([...combined, ...broad]);
    }
  }

  return combined;
}
