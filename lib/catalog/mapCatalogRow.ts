import type { CriticsVsFans, Movie } from '@/lib/types';
import { getOscarAwardInfo, isOscarNomineeId, isOscarWinnerId } from '@/lib/data/oscar-truth';
import { prestigeDirectorMatch } from '@/lib/prestigeScore';
import { PROMINENCE_TRUTH_LIST } from '@/lib/prominence';
import { watchProvidersForRegion } from '@/lib/watchProviders';
import type { CatalogMovieRow } from './catalogRow';
import {
  criticsVsFansLabel,
  deriveSlidersFromMetadata,
  genresFromIds,
  tagsFromKeywords,
} from './keywordTags';

export function mapCatalogRowToMovie(row: CatalogMovieRow): Movie {
  const genreIds = Array.isArray(row.genre_ids) ? row.genre_ids : [];
  const keywordNames = (row.keyword_names ?? []).map((k) => String(k).trim()).filter(Boolean);
  const genre = genresFromIds(genreIds);
  const { theme, visualStyle, soundtrack } = tagsFromKeywords(keywordNames);
  const sliders = deriveSlidersFromMetadata(genreIds, keywordNames);

  const releaseDate = row.release_date?.trim() || null;
  const year = releaseDate ? new Date(releaseDate).getFullYear() : 0;

  const castRaw = row.credits?.cast ?? [];
  const castSorted = [...castRaw].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  const castCredits = castSorted.slice(0, 5).map((c) => ({
    id: c.id,
    name: c.name,
    popularity: c.popularity ?? 0,
    order: c.order,
  }));
  const crewCredits = (row.credits?.crew ?? [])
    .filter((c) => c.job === 'Director')
    .map((c) => ({
      id: c.id,
      name: c.name,
      job: c.job,
      popularity: c.popularity ?? 0,
    }));

  const director = crewCredits[0];
  const directorPopularityRaw = director?.popularity ?? 0;
  const aListIds = new Set(PROMINENCE_TRUTH_LIST.a_list_actors.map((a) => a.id));
  const hasAListCast =
    castSorted.slice(0, 3).some((c) => aListIds.has(c.id)) ||
    castSorted.slice(0, 3).some((c) => (c.popularity ?? 0) >= 8);

  const prestigePartial = {
    castCredits: castSorted.slice(0, 3).map((c) => ({
      id: c.id,
      name: c.name,
      popularity: c.popularity ?? 0,
      order: c.order,
    })),
    crewCredits,
  } as Movie;

  const directorProminence = Math.round(
    prestigeDirectorMatch(prestigePartial, 100, PROMINENCE_TRUTH_LIST)
  );

  const voteAverage = row.vote_average ?? 0;
  const voteCount = row.vote_count ?? 0;
  const criticsVsFans: CriticsVsFans = criticsVsFansLabel(voteAverage, voteCount);

  const oscarWinner = isOscarWinnerId(row.tmdb_id);
  const oscarNominee = isOscarNomineeId(row.tmdb_id) || oscarWinner;
  const oscarInfo = getOscarAwardInfo(row.tmdb_id);

  return {
    id: `tmdb-${row.tmdb_id}`,
    title: row.title ?? '',
    year: year || 0,
    releaseDate: releaseDate ?? undefined,
    overview: row.overview?.trim() || undefined,
    tagline: row.tagline?.trim() || '',
    posterColor: 'from-slate-800 to-amber-900',
    posterPath: row.poster_path ?? undefined,
    crowd: [],
    ...sliders,
    pacing: sliders.narrative_pacing,
    cryMeter: sliders.emotional_tone,
    humor: sliders.brain_power,
    romance: sliders.visual_style,
    suspense: sliders.suspense_level,
    intensity: sliders.world_style,
    genre,
    genreIds,
    keywordNames,
    theme,
    visualStyle,
    soundtrack,
    boxOffice: row.revenue ?? 0,
    budget: row.budget ?? 0,
    rating: voteAverage,
    hasAListCast,
    criticsVsFans,
    oscarWinner,
    oscarNominee,
    ...(oscarInfo
      ? { academyAwardYear: oscarInfo.year, academyAwardType: oscarInfo.type }
      : {}),
    runtimeMinutes: row.runtime_minutes ?? 0,
    directorProminence,
    directorPopularityRaw: directorPopularityRaw || undefined,
    popularity: row.popularity ?? 0,
    voteCount,
    imdbId: row.imdb_id ?? null,
    trailerKey: row.trailer_youtube_key ?? null,
    castCredits,
    crewCredits,
    collectionId: row.collection_id ?? row.belongs_to_collection?.id ?? null,
    originalLanguage: row.original_language ?? null,
    watchProvidersUs: watchProvidersForRegion(row.watch_providers, 'US'),
  };
}
