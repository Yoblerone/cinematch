import type { FilterState, Movie, Decade } from './types';
import type { TmdbMovieResult } from './tmdb';
import { mapTmdbToMovie, GENRE_NAME_TO_ID } from './tmdb';
import { HISTORICAL_ERA_YEAR_RANGES, NEW_RELEASES_WINDOW_DAYS } from './era';
import {
  nearestFilterWeightStop,
  FILTER_WEIGHT_HIGH,
  FILTER_WEIGHT_LOW,
  FILTER_WEIGHT_MED,
} from './filterWeightSegments';
import { buildEnergyAxisConstraints } from './scoring/energyAxisGuards';
import {
  claudeRerankModel,
  CLAUDE_RERANK_MAX_OUTPUT_TOKENS,
  CLAUDE_RERANK_KEYWORD_SNIPPETS,
  CLAUDE_RERANK_OVERVIEW_CHARS,
  MAX_CLAUDE_BACKFILL_SEARCHES,
} from './catalog/claudeRerankConfig';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const TMDB_SEARCH = 'https://api.themoviedb.org/3/search/movie';
const CLAUDE_POOL_CAP = 48;

function buildDecadeConstraint(decades: FilterState['decade']): string {
  const valid = (decades ?? []).filter((d): d is NonNullable<Decade> => d != null);
  if (valid.length === 0) return '';

  const parts: string[] = [];
  for (const era of valid) {
    if (era === 'new-releases') {
      parts.push(`released within the last ${NEW_RELEASES_WINDOW_DAYS} days`);
    } else {
      const [start, end] = HISTORICAL_ERA_YEAR_RANGES[era];
      parts.push(`released between ${start} and ${end}`);
    }
  }
  return ` Only include films ${parts.join(' OR ')} — do not suggest films outside these date ranges.`;
}

function buildVibeDescriptionClause(filters: FilterState): string {
  const parts: string[] = [];
  const pacing = filters.narrative_pacing;
  if (pacing != null) {
    const stop = nearestFilterWeightStop(pacing);
    if (stop === FILTER_WEIGHT_HIGH) parts.push('fast-paced');
    else if (stop === FILTER_WEIGHT_LOW) parts.push('slow-paced');
  }

  const tone = filters.emotional_tone;
  if (tone != null) {
    const stop = nearestFilterWeightStop(tone);
    if (stop === FILTER_WEIGHT_HIGH) parts.push('emotionally heavy');
    else if (stop === FILTER_WEIGHT_LOW) parts.push('light and fun');
  }

  const brain = filters.brain_power;
  if (brain != null) {
    const stop = nearestFilterWeightStop(brain);
    if (stop === FILTER_WEIGHT_HIGH) parts.push('thought-provoking and intellectual');
    else if (stop === FILTER_WEIGHT_LOW) parts.push('escapist entertainment');
  }

  const visual = filters.visual_style;
  if (visual != null) {
    const stop = nearestFilterWeightStop(visual);
    if (stop === FILTER_WEIGHT_HIGH) parts.push('epic visual scale');
    else if (stop === FILTER_WEIGHT_MED) parts.push('cinematic and visually distinctive');
    else if (stop === FILTER_WEIGHT_LOW) parts.push('intimate and raw');
  }

  const suspense = filters.suspense_level;
  if (suspense != null) {
    const stop = nearestFilterWeightStop(suspense);
    if (stop === FILTER_WEIGHT_HIGH) parts.push('tense and suspenseful');
    else if (stop === FILTER_WEIGHT_LOW) parts.push('relaxed and low-stakes');
  }

  const world = filters.world_style;
  if (world != null) {
    const stop = nearestFilterWeightStop(world);
    if (stop === FILTER_WEIGHT_HIGH) parts.push('surreal or fantastical worlds');
    else if (stop === FILTER_WEIGHT_MED) parts.push('stylized and heightened worlds');
    else if (stop === FILTER_WEIGHT_LOW) parts.push('grounded and realistic worlds');
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

  if (filters.criticsVsFans === 'critics') {
    parts.push(
      'that are critically acclaimed — prioritize films with high ratings from discerning audiences, arthouse cinema, award contenders, and films respected by critics even if they had limited commercial release. Avoid pure blockbusters.',
    );
  } else if (filters.criticsVsFans === 'fans') {
    parts.push(
      'that are beloved by general audiences — prioritize crowd-pleasing films with massive popularity, high vote counts, and wide commercial appeal. Include beloved blockbusters, franchises, and mainstream hits.',
    );
  } else if (filters.criticsVsFans === 'both') {
    parts.push(
      'that are both critically respected and widely loved by audiences — prioritize films that score high on both quality and popularity, films that achieved crossover success with critics and mainstream audiences alike.',
    );
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
  const lines = pool.slice(0, CLAUDE_POOL_CAP).map((m, i) => {
    const genres = m.genre?.length ? m.genre.join(', ') : 'unknown';
    const kw = (m.keywordNames ?? []).slice(0, CLAUDE_RERANK_KEYWORD_SNIPPETS).join(', ');
    const overview =
      typeof m.overview === 'string' && m.overview.trim()
        ? m.overview.trim().slice(0, CLAUDE_RERANK_OVERVIEW_CHARS).replace(/\s+/g, ' ')
        : '';
    const bits = [`${i + 1}. ${m.title} (${m.year || '?'})`, `[${genres}]`];
    if (kw) bits.push(`keywords: ${kw}`);
    if (overview) bits.push(`— ${overview}`);
    return bits.join(' ');
  });
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
  const log = process.env.NODE_ENV === 'development';
  if (log) {
    console.log('[CLAUDE RERANK] pool:', pool.length, 'model:', claudeRerankModel());
  }
  try {
    const vibeDescription = buildVibeDescriptionClause(filters);
    const axisConstraints = buildEnergyAxisConstraints(filters);
    const list = numberedTitles(pool);
    const genreList = filters.genre.length > 0 ? filters.genre.join(', ') : 'none selected';

    const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!anthropicKey) {
      return pool;
    }

    const decadeConstraint = buildDecadeConstraint(filters.decade);
    const offPoolConstraint = filters.genre.length > 0
      ? ` Any film you suggest that is not in the list above must genuinely be a ${genreList} film — do not suggest films that are not actually in those genres.`
      : '';
    const userMessage = `Here are up to ${CLAUDE_POOL_CAP} movies from a discovery pool: ${list}. ${vibeDescription}${axisConstraints} IMPORTANT: Only include films that genuinely belong in ALL of these genres: ${genreList}. A film must fit every selected genre to appear in the list. Do not include films that only match one genre.${decadeConstraint} Rank by fit to ALL vibe constraints above — mismatched energy (e.g. fairy-tale fantasy when grounded realism was requested, or a slow grief drama when fast-paced was requested) should score below 40 and be omitted. Return a JSON array of exactly 36 objects ranked best to worst match. Each object must have exactly two fields: title (string) and match (integer 0-100). For each film return a match percentage (0-100) representing how well it fits ALL of the specified criteria. 100 means perfect fit, 0 means no fit. You may include at most 3 films not in the list above if they are an exceptional match — well-known, wide release only.${offPoolConstraint} Return only the JSON array.`;

    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': anthropicKey,
      },
      body: JSON.stringify({
        model: claudeRerankModel(),
        max_tokens: CLAUDE_RERANK_MAX_OUTPUT_TOKENS,
        system:
          'You are an expert film curator. Return only a raw JSON array of objects, no markdown, no backticks, no explanation, no preamble. Start your response with [ and end with ]. Each object must have exactly two fields: title (string) and match (integer 0-100).',
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    if (log) console.log('[CLAUDE RERANK] status:', response.status);

    if (!response.ok) {
      return pool;
    }
    const rawJson = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const block = rawJson.content?.find((c) => c.type === 'text' && typeof c.text === 'string');
    const rawText = block?.text;
    if (typeof rawText !== 'string') {
      return pool;
    }

    const rankedItems = parseRankedItems(rawText);
    if (log) {
      console.log('[CLAUDE RERANK] titles:', (rankedItems ?? []).map((x) => x.title).slice(0, 10));
    }
    if (!rankedItems) {
      return pool;
    }

    const byLowerTitle = poolTitleIndex(pool);
    const out: Movie[] = [];
    const seen = new Set<string>();
    let backfillSearches = 0;

    // Pre-compute required genre IDs for backfill validation.
    // Backfill films come from Claude suggestions that TMDB Discover didn't surface — meaning
    // TMDB's own tagging is already incomplete for that combo. Requiring ALL genre tags would
    // use the same incomplete system to reject valid matches. Instead, require AT LEAST ONE
    // selected genre to be present (blocks clearly off-genre hallucinations while allowing
    // genuine matches that TMDB under-tags).
    const requiredGenreIds = filters.genre
      .map((g) => GENRE_NAME_TO_ID[g])
      .filter((id): id is number => id != null);

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

      if (backfillSearches >= MAX_CLAUDE_BACKFILL_SEARCHES) continue;
      backfillSearches += 1;
      const found = await searchMovieByTitle(title, apiKey);
      if (!found) continue;
      const suggested = movieFromSearchResult(found);

      // Genre gate: backfill suggestions must match AT LEAST ONE selected genre per TMDB genre_ids.
      // Using `some` because TMDB tagging is incomplete for niche combos — the pool-level `every`
      // filter and the Claude prompt already block clearly off-genre hallucinations.
      if (requiredGenreIds.length > 0) {
        const movieGenreIds = suggested.genreIds ?? [];
        const hasAnyGenre = requiredGenreIds.some((id) => movieGenreIds.includes(id));
        if (!hasAnyGenre) continue;
      }

      suggested.matchPercentage = item.match;
      out.push(suggested);
    }

    return out.length > 0 ? out : pool;
  } catch (err) {
    console.log('[CLAUDE RERANK] error:', err);
    return pool;
  }
}
