import { NextRequest, NextResponse } from 'next/server';
import type { FilterState } from '@/lib/types';
import { getTmdbMatches } from '@/lib/tmdbEnrich';

export async function POST(request: NextRequest) {
  let filters: FilterState;
  let discoverStartPage: number | undefined;
  try {
    const body = await request.json();
    filters = body as FilterState;
    const rawOscar = (body as Record<string, unknown>).oscarFilter;
    if (rawOscar === 'winner' || rawOscar === 'Winner') {
      filters = { ...filters, oscarFilter: 'winner' };
    }
    if (rawOscar === 'nominee' || rawOscar === 'Nominee') {
      filters = { ...filters, oscarFilter: 'nominee' };
    }
    if (rawOscar === 'both' || rawOscar === 'Both') {
      filters = { ...filters, oscarFilter: 'both' };
    }
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
