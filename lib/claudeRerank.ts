import type { FilterState, Movie } from './types';
import type { TmdbMovieResult } from './tmdb';
import { mapTmdbToMovie } from './tmdb';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const TMDB_SEARCH = 'https://api.themoviedb.org/3/search/movie';

function buildVibeDescriptionClause(filters: FilterState): string {
  const parts: string[] = [];
  const pacing = filters.narrative_pacing;
  if (pacing != null) {
    if (pacing >= 80) parts.push('fast-paced');
    else if (pacing <= 20) parts.push('slow-paced');
  }

  const tone = filters.emotional_tone;
  if (tone != null) {
    if (tone >= 80) parts.push('emotionally heavy');
    else if (tone <= 20) parts.push('light and fun');
  }

  const brain = filters.brain_power;
  if (brain != null) {
    if (brain >= 80) parts.push('thought-provoking and intellectual');
    else if (brain <= 20) parts.push('escapist entertainment');
  }

  const visual = filters.visual_style;
  if (visual != null) {
    if (visual >= 80) parts.push('epic visual scale');
    else if (visual >= 30 && visual <= 79) parts.push('cinematic and visually distinctive');
    else if (visual <= 20) parts.push('intimate and raw');
  }

  const suspense = filters.suspense_level;
  if (suspense != null) {
    if (suspense >= 80) parts.push('tense and suspenseful');
    else if (suspense <= 20) parts.push('relaxed and low-stakes');
  }

  const world = filters.world_style;
  if (world != null) {
    if (world >= 80) parts.push('surreal or fantastical');
    else if (world >= 30 && world <= 79) parts.push('stylized and heightened');
    else if (world <= 20) parts.push('grounded and realistic');
  }

  if (filters.aListCast === 'high') {
    parts.push(
      'featuring major Hollywood A-list stars like Tom Hanks, Brad Pitt, Meryl Streep, Leonardo DiCaprio — household names with decades of fame',
    );
  } else if (filters.aListCast === 'low') {
    parts.push(
      'featuring unknown or little-known actors — avoid major Hollywood stars but do not require complete unknowns. Prefer foreign language films, indie films, and films where the leads were not yet famous. Return as many qualifying films as you can find up to 36.',
    );
  }

  if (filters.directorProminence === 'high') {
    parts.push(
      'directed by acclaimed directors with strong critical reputations and distinctive bodies of work',
    );
  } else if (filters.directorProminence === 'low') {
    parts.push('directed by debut or lesser-known filmmakers');
  }

  if (filters.oscarFilter === 'winner') {
    parts.push('that won the Academy Award for Best Picture');
  } else if (filters.oscarFilter === 'nominee') {
    parts.push('that were nominated for the Academy Award for Best Picture');
  } else if (filters.oscarFilter === 'both') {
    parts.push('that were nominated for or won the Academy Award for Best Picture');
  }

  if (parts.length === 0) return 'The user wants films that are: balanced recommendations.';
  if (parts.length === 1) return `The user wants films that are: ${parts[0]}.`;
  if (parts.length === 2) return `The user wants films that are: ${parts[0]} and ${parts[1]}.`;
  return `The user wants films that are: ${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}.`;
}

function numberedTitles(pool: Movie[]): string {
  const lines = pool.slice(0, 60).map((m, i) => `${i + 1}. ${m.title}`);
  return lines.join('\n');
}

function extractJsonArrayText(raw: string): string | null {
  const t = raw.trim();
  const start = t.indexOf('[');
  const end = t.lastIndexOf(']');
  if (start === -1 || end <= start) return null;
  return t.slice(start, end + 1);
}

type ClaudeRankedItem = {
  title: string;
  match: number;
};

function parseRankedItems(text: string): ClaudeRankedItem[] | null {
  const slice = extractJsonArrayText(text);
  if (!slice) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(slice) as unknown;
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const items: ClaudeRankedItem[] = [];
  for (const x of parsed) {
    if (typeof x !== 'object' || x == null) continue;
    const rec = x as { title?: unknown; match?: unknown };
    if (typeof rec.title !== 'string' || !rec.title.trim()) continue;
    if (typeof rec.match !== 'number' || !Number.isFinite(rec.match)) continue;
    const match = Math.max(0, Math.min(100, Math.round(rec.match)));
    items.push({ title: rec.title.trim(), match });
  }
  return items.length > 0 ? items : null;
}

function poolTitleIndex(pool: Movie[]): Map<string, Movie> {
  const map = new Map<string, Movie>();
  for (const m of pool) {
    map.set(m.title.trim().toLowerCase(), m);
  }
  return map;
}

async function searchMovieByTitle(title: string, tmdbApiKey: string): Promise<TmdbMovieResult | null> {
  const url = `${TMDB_SEARCH}?query=${encodeURIComponent(title)}&api_key=${encodeURIComponent(tmdbApiKey)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as { results?: TmdbMovieResult[] };
  const first = data.results?.[0];
  return first ?? null;
}

function movieFromSearchResult(r: TmdbMovieResult): Movie {
  const base = mapTmdbToMovie(r);
  const pop = (r as { popularity?: number }).popularity;
  const votes = (r as { vote_count?: number }).vote_count;
  return {
    ...base,
    posterPath: r.poster_path ?? undefined,
    genreIds: [...(r.genre_ids ?? [])],
    popularity: typeof pop === 'number' && Number.isFinite(pop) ? pop : base.popularity ?? 0,
    voteCount: typeof votes === 'number' && Number.isFinite(votes) ? votes : base.voteCount ?? 0,
    claudeSuggested: true,
  };
}

export async function claudeRerank(pool: Movie[], filters: FilterState, apiKey: string): Promise<Movie[]> {
  console.log(
    '[CLAUDE RERANK] called, ANTHROPIC_API_KEY present:',
    !!process.env.ANTHROPIC_API_KEY,
    'pool size:',
    pool.length,
  );
  try {
    const vibeDescription = buildVibeDescriptionClause(filters);
    const list = numberedTitles(pool);
    const genreList = filters.genre.length > 0 ? filters.genre.join(', ') : 'none selected';

    const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!anthropicKey) {
      return pool;
    }

    const userMessage = `Here are up to 60 movies from a discovery pool: ${list}. ${vibeDescription} IMPORTANT: Only include films that genuinely belong in ALL of these genres: ${genreList}. A film must fit every selected genre to appear in the list. Do not include films that only match one genre. Return a JSON array of exactly 36 objects ranked best to worst match. Each object must have exactly two fields: title (string) and match (integer 0-100). For each film return a match percentage (0-100) representing how well it fits ALL of the specified criteria. 100 means perfect fit, 0 means no fit. You may include films not in the list above if they are a strong match — but only well-known films with wide release. Return only the JSON array.`;

    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': anthropicKey,
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1500,
        system:
          'You are an expert film curator. Return only a raw JSON array of objects, no markdown, no backticks, no explanation, no preamble. Start your response with [ and end with ]. Each object must have exactly two fields: title (string) and match (integer 0-100).',
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    console.log('[CLAUDE RERANK] response status:', response.status);
    const rawJson = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    console.log('[CLAUDE RERANK] raw json:', JSON.stringify(rawJson).slice(0, 500));

    if (!response.ok) {
      return pool;
    }
    const block = rawJson.content?.find((c) => c.type === 'text' && typeof c.text === 'string');
    const rawText = block?.text;
    if (typeof rawText !== 'string') {
      return pool;
    }

    const rankedItems = parseRankedItems(rawText);
    const titlesArray = (rankedItems ?? []).map((x) => x.title);
    console.log('[CLAUDE RERANK] prompt:', userMessage);
    console.log('[CLAUDE RERANK] raw response:', rawText);
    console.log('[CLAUDE RERANK] final titles:', titlesArray);
    if (!rankedItems) {
      return pool;
    }

    const byLowerTitle = poolTitleIndex(pool);
    const out: Movie[] = [];
    const seen = new Set<string>();

    for (const item of rankedItems.slice(0, 36)) {
      const title = item.title;
      const key = title.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const fromPool = byLowerTitle.get(key);
      if (fromPool) {
        fromPool.matchPercentage = item.match;
        out.push(fromPool);
        continue;
      }

      const found = await searchMovieByTitle(title, apiKey);
      if (!found) continue;
      const suggested = movieFromSearchResult(found);
      suggested.matchPercentage = item.match;
      out.push(suggested);
    }

    return out.length > 0 ? out : pool;
  } catch (err) {
    console.log('[CLAUDE RERANK] error:', err);
    return pool;
  }
}
