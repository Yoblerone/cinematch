import { NextRequest, NextResponse } from 'next/server';
import type { Genre, Decade, Runtime } from '@/lib/types';
import { buildDiscoverSearchParams, mapTmdbToMovie, type TmdbDiscoverResponse } from '@/lib/tmdb';

const TMDB_BASE = 'https://api.themoviedb.org/3/discover/movie';

const VALID_GENRES: Genre[] = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama',
  'Family', 'Fantasy', 'History', 'Horror', 'Music', 'Mystery', 'Romance',
  'Sci-Fi', 'Thriller', 'War', 'Western',
];
type DecadeValue = Exclude<Decade, null>;
type RuntimeValue = Exclude<Runtime, null>;
const VALID_DECADES: DecadeValue[] = ['60s', '70s', '80s', '90s', '2000s', '2010s', '2020s'];
const VALID_RUNTIMES: RuntimeValue[] = ['short', 'medium', 'long'];

export async function GET(request: NextRequest) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'TMDB_API_KEY is not set. Add it to .env.local (see .env.example).' },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const genreParam = searchParams.get('genre');
  const decadeParam = searchParams.get('decade');
  const runtimeParam = searchParams.get('runtime');
  const pageParam = searchParams.get('page');

  const genre: Genre | null =
    genreParam && VALID_GENRES.includes(genreParam as Genre) ? (genreParam as Genre) : null;
  const decade: Decade =
    decadeParam && VALID_DECADES.includes(decadeParam as DecadeValue) ? (decadeParam as DecadeValue) : null;
  const runtime: Runtime =
    runtimeParam && VALID_RUNTIMES.includes(runtimeParam as RuntimeValue) ? (runtimeParam as RuntimeValue) : null;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);

  const params = buildDiscoverSearchParams({
    genre: genre ? [genre] : undefined,
    decade: decade ? [decade] : undefined,
    runtime: runtime ?? null,
    page,
  });
  const url = new URL(TMDB_BASE);
  url.searchParams.set('api_key', apiKey);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  let res: Response;
  try {
    res = await fetch(url.toString(), { next: { revalidate: 300 } });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to reach TMDB', details: String(e) }, { status: 502 });
  }

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: 'TMDB request failed', status: res.status, body: text.slice(0, 200) },
      { status: 502 }
    );
  }

  const data = (await res.json()) as TmdbDiscoverResponse;
  const movies = (data.results ?? []).map(mapTmdbToMovie);

  return NextResponse.json({
    movies,
    page: data.page,
    totalPages: data.total_pages,
    totalResults: data.total_results,
  });
}
