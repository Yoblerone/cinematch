import { NextRequest, NextResponse } from 'next/server';
import { parseTmdbMovieId } from '@/lib/tmdb';

const TMDB_BASE = 'https://api.themoviedb.org/3';

/** TMDB watch/providers → availability by region (flatrate / rent / buy). */
export async function GET(request: NextRequest) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'TMDB_API_KEY is not set. Add it to .env.local (see .env.example).' },
      { status: 503 }
    );
  }

  const movieIdStr = request.nextUrl.searchParams.get('movieId') ?? '';
  const region =
    (request.nextUrl.searchParams.get('region') ?? 'US').trim().toUpperCase() || 'US';

  const id = parseTmdbMovieId(movieIdStr);
  if (!id) {
    return NextResponse.json({ error: 'Invalid movie id' }, { status: 400 });
  }

  try {
    const url = `${TMDB_BASE}/movie/${id}/watch/providers?api_key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: 'TMDB watch providers request failed', details: `${res.status}: ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }
    const body = (await res.json()) as {
      results?: Record<
        string,
        | {
            link?: string;
            flatrate?: { provider_id: number; provider_name: string; logo_path?: string | null }[];
            rent?: { provider_id: number; provider_name: string; logo_path?: string | null }[];
            buy?: { provider_id: number; provider_name: string; logo_path?: string | null }[];
          }
        | undefined
      >;
    };

    const bucket = body.results?.[region];
    return NextResponse.json({
      region,
      link: bucket?.link ?? null,
      flatrate: bucket?.flatrate ?? [],
      rent: bucket?.rent ?? [],
      buy: bucket?.buy ?? [],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'Watch providers fetch failed', details: message }, { status: 502 });
  }
}
