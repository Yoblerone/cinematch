import { NextRequest, NextResponse } from 'next/server';
import type { FilterState } from '@/lib/types';
import { getTmdbMatches } from '@/lib/tmdbEnrich';

export async function POST(request: NextRequest) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'TMDB_API_KEY is not set. Add it to .env.local (see .env.example).' },
      { status: 503 }
    );
  }

  let filters: FilterState;
  let discoverStartPage: number | undefined;
  try {
    const body = await request.json();
    filters = body as FilterState;
    discoverStartPage = typeof body.discoverStartPage === 'number' && body.discoverStartPage >= 1 && body.discoverStartPage <= 10
      ? Math.floor(body.discoverStartPage)
      : undefined;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
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
