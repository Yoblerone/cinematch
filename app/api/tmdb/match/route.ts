import { NextRequest, NextResponse } from 'next/server';
import type { FilterState } from '@/lib/types';
import { defaultFilters } from '@/lib/types';
import { getTmdbMatches } from '@/lib/tmdbEnrich';
import { normalizeOriginalLanguageFilterInput } from '@/lib/originalLanguage';
/** Thematic density V2: `getTmdbMatches` → `filterMovies` + `lib/scoring/energyManifest.ts` + `lib/scoring/thematicDensity.ts` (no `fetchMovies.ts` in this app). */

export async function POST(request: NextRequest) {
  let filters: FilterState;
  let discoverStartPage: number | undefined;
  try {
    const body = await request.json();
    const raw = body as Partial<FilterState> & {
      aListCastAny?: boolean;
      directorProminenceAny?: boolean;
    };
    const asWeight = (v: unknown): number => {
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(n)) return 50;
      return Math.max(0, Math.min(100, Math.round(n)));
    };
    const asMaybeWeight = (v: unknown): number | null => (v == null || v === '' ? null : asWeight(v));
    const narrative_pacing = asMaybeWeight(raw.narrative_pacing ?? raw.pacing ?? null);
    const emotional_tone = asMaybeWeight(raw.emotional_tone ?? raw.cryMeter ?? null);
    const brain_power = asMaybeWeight(raw.brain_power ?? raw.humor ?? null);
    const visual_style = asMaybeWeight(raw.visual_style ?? raw.romance ?? null);
    const suspense_level = asMaybeWeight(raw.suspense_level ?? raw.suspense ?? null);
    const world_style = asMaybeWeight(raw.world_style ?? raw.intensity ?? null);
    const asPedigreeBand = (v: unknown): 'low' | 'high' | null => {
      if (v == null || v === '') return null;
      if (v === 'low' || v === 'high') return v;
      return null;
    };
    const aListCast = asPedigreeBand(raw.aListCast);
    const directorProminence = asPedigreeBand(raw.directorProminence);
    filters = {
      ...defaultFilters,
      ...(raw as Partial<FilterState>),
      narrative_pacing,
      emotional_tone,
      brain_power,
      visual_style,
      suspense_level,
      world_style,
      // Keep legacy aliases in sync for untouched modules.
      pacing: narrative_pacing,
      cryMeter: emotional_tone,
      humor: brain_power,
      romance: visual_style,
      suspense: suspense_level,
      intensity: world_style,
      aListCast,
      directorProminence,
      genre: Array.isArray(raw.genre) ? raw.genre : defaultFilters.genre,
      decade: Array.isArray(raw.decade) ? raw.decade.filter((d): d is NonNullable<typeof d> => d != null) : defaultFilters.decade,
    };
    const rawOscar = (body as Record<string, unknown>).oscarFilter;
    if (rawOscar === 'winner' || rawOscar === 'Winner') {
      filters = { ...filters, oscarFilter: 'winner' };
    } else if (rawOscar === 'nominee' || rawOscar === 'Nominee') {
      filters = { ...filters, oscarFilter: 'nominee' };
    } else if (rawOscar === 'both' || rawOscar === 'Both') {
      filters = { ...filters, oscarFilter: 'both' };
    } else {
      filters = { ...filters, oscarFilter: null };
    }
    const rawLang =
      (body as Record<string, unknown>).originalLanguage ??
      (body as Record<string, unknown>).originCountry;
    const migrated =
      rawLang === 'international-nonenglish'
        ? 'world-cinema'
        : rawLang === 'international-english'
          ? null
          : rawLang;
    filters = {
      ...filters,
      originalLanguage: normalizeOriginalLanguageFilterInput(migrated),
    };
    discoverStartPage = typeof body.discoverStartPage === 'number' && body.discoverStartPage >= 1 && body.discoverStartPage <= 10
      ? Math.floor(body.discoverStartPage)
      : undefined;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'TMDB_API_KEY is not set. Add it to .env.local (see .env.example).' },
      { status: 503 }
    );
  }

  try {
    const movies = await getTmdbMatches(apiKey, filters, { discoverStartPage });
    return NextResponse.json({ movies });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: 'TMDB match failed', details: message },
      { status: 502 }
    );
  }
}
