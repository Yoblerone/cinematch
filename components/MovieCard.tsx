'use client';

import { motion } from 'framer-motion';
import { Star, ExternalLink, Play, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { Movie } from '@/lib/types';
import { parseTmdbMovieId } from '@/lib/tmdb';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const IMDB_TITLE_BASE = 'https://www.imdb.com/title';

interface MovieCardProps {
  movie: Movie;
  index: number;
  variant?: 'featured' | 'compact';
  /** 0–100 match score for results list (rank / rating derived). */
  matchPercent?: number;
}

type WatchProviderApi = {
  provider_id: number;
  provider_name: string;
  logo_path?: string | null;
};

type WatchProvidersPayload = {
  region: string;
  link: string | null;
  flatrate: WatchProviderApi[];
  rent: WatchProviderApi[];
  buy: WatchProviderApi[];
};

function providerNamesUnique(rows: WatchProviderApi[]): string[] {
  const seen = new Set<number>();
  const out: string[] = [];
  for (const r of rows) {
    if (seen.has(r.provider_id)) continue;
    seen.add(r.provider_id);
    out.push(r.provider_name);
  }
  return out;
}

function StreamingProvidersDetail({
  payload,
  linkTextBase,
  linkIconClass,
  isFeatured,
}: {
  payload: WatchProvidersPayload;
  linkTextBase: string;
  linkIconClass: string;
  isFeatured: boolean;
}) {
  const flat = providerNamesUnique(payload.flatrate);
  const noneListed = flat.length === 0;

  return (
    <>
      <p className="text-antique/90 mb-1.5">Where to watch ({payload.region})</p>
      {flat.length > 0 ? (
        <p>
          <span className="text-brass-light font-medium">Subscribe </span>
          <span>{flat.join(' · ')}</span>
        </p>
      ) : null}
      {noneListed ? (
        <p className="text-antique italic">No streaming listings for this region in TMDB right now.</p>
      ) : null}
      {payload.link ? (
        <a
          href={payload.link}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-2 inline-flex items-center gap-1 ${linkTextBase} ${isFeatured ? 'text-sm' : 'text-xs'}`}
        >
          <ExternalLink className={linkIconClass} aria-hidden />
          TMDB availability page
        </a>
      ) : null}
    </>
  );
}

export default function MovieCard({ movie, index, variant = 'compact', matchPercent }: MovieCardProps) {
  const isFeatured = variant === 'featured';
  const ratingN = Number(movie.rating ?? 0);
  const posterUrl = movie.posterPath
    ? `${TMDB_IMAGE_BASE}/${isFeatured ? 'w500' : 'w342'}${movie.posterPath}`
    : null;

  const tmdbNumericId = parseTmdbMovieId(movie.id);
  const showStreamingUi = tmdbNumericId > 0;

  const linkTextBase =
    'inline-flex items-center gap-1 text-brass hover:text-neon-gold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass/70 rounded-sm';
  const linkIconClass = isFeatured ? 'w-3.5 h-3.5' : 'w-3 h-3';

  const [streamingOpen, setStreamingOpen] = useState(false);
  const [providersPayload, setProvidersPayload] = useState<WatchProvidersPayload | null>(null);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providersError, setProvidersError] = useState<string | null>(null);

  const toggleStreaming = async () => {
    if (streamingOpen) {
      setStreamingOpen(false);
      return;
    }
    setStreamingOpen(true);
    if (providersPayload !== null || providersLoading) return;
    setProvidersLoading(true);
    setProvidersError(null);
    try {
      const res = await fetch(
        `/api/tmdb/watch-providers?movieId=${encodeURIComponent(movie.id)}&region=US`
      );
      const json = (await res.json()) as WatchProvidersPayload & { error?: string; details?: string };
      if (!res.ok) {
        throw new Error(
          typeof json.error === 'string' ? json.error : json.details ?? 'Could not load streaming info'
        );
      }
      setProvidersPayload(json);
    } catch (e) {
      setProvidersError(e instanceof Error ? e.message : 'Could not load streaming info');
    } finally {
      setProvidersLoading(false);
    }
  };

  const showLinksRow =
    (movie.trailerKey != null && movie.trailerKey !== '') ||
    !!movie.imdbId ||
    showStreamingUi;

  const streamingPanelId = `streaming-panel-${movie.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const streamingTriggerId = `streaming-trigger-${movie.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`card-hover relative group rounded-xl border-2 border-brass/60 overflow-hidden ${
        isFeatured ? 'bg-cherry-900' : 'bg-cherry-900'
      }`}
    >
      <div
        className="projector-shimmer absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10"
        aria-hidden
      />
      <div
        className={`relative overflow-hidden ${
          isFeatured ? 'h-56 sm:h-64' : 'h-28 sm:h-32'
        } bg-gradient-to-br ${movie.posterColor}`}
      >
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={`${movie.title} poster`}
            className="w-full h-full object-cover"
            sizes={isFeatured ? '(min-width: 640px) 33vw, 100vw' : '114px'}
          />
        ) : null}
      </div>
      <div className={`relative ${isFeatured ? 'p-5' : 'p-3'}`}>
        <div className="flex items-start justify-between gap-2">
          <h3
            className={`font-display font-semibold text-neon-gold group-hover:text-neon-glow transition-shadow ${
              isFeatured ? 'text-xl' : 'text-base'
            }`}
          >
            {movie.title}
          </h3>
          <div
            className="flex flex-col items-end gap-0.5 shrink-0 text-neon-gold"
            title={`TMDB rating: ${Number.isFinite(ratingN) ? ratingN.toFixed(1) : '—'} / 10 (vote_average)`}
          >
            <div className="flex items-center gap-1">
              <Star className={isFeatured ? 'w-5 h-5' : 'w-4 h-4'} fill="currentColor" aria-hidden />
              <span className={`font-semibold tabular-nums ${isFeatured ? 'text-lg' : 'text-sm'}`}>
                {ratingN > 0 ? ratingN.toFixed(1) : '—'}
                {ratingN > 0 && (
                  <span
                    className={`text-cream/90 font-normal opacity-80 ${isFeatured ? 'text-sm' : 'text-[10px]'}`}
                  >
                    /10
                  </span>
                )}
              </span>
            </div>
            {matchPercent != null && (
              <span
                className={`tabular-nums text-slate-400 ${isFeatured ? 'text-xs' : 'text-[10px] leading-tight'}`}
                title="Match score"
              >
                {matchPercent}% Match
              </span>
            )}
          </div>
        </div>
        <p className={`text-cream ${isFeatured ? 'text-sm mt-1' : 'text-xs mt-0.5'}`}>
          {movie.year}
        </p>
        {movie.academyAwardYear != null && movie.academyAwardType && (
          <p className={`text-neon-gold font-medium ${isFeatured ? 'text-sm mt-0.5' : 'text-xs mt-0.5'}`}>
            {movie.academyAwardType === 'Winner'
              ? `Academy Award Winner ${movie.academyAwardYear}`
              : `Best Picture Nominee ${movie.academyAwardYear}`}
          </p>
        )}
        {movie.tagline && (
          <p
            className={`text-cream/90 italic ${isFeatured ? 'text-sm mt-2' : 'text-xs mt-1'} line-clamp-2`}
          >
            &ldquo;{movie.tagline}&rdquo;
          </p>
        )}
        {showLinksRow ? (
          <>
            <div
              className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 ${isFeatured ? 'text-sm' : 'text-xs'}`}
            >
              {movie.trailerKey != null && movie.trailerKey !== '' ? (
                <a
                  href={`https://www.youtube.com/watch?v=${encodeURIComponent(movie.trailerKey)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${linkTextBase} ${isFeatured ? 'text-sm' : 'text-xs'}`}
                  title="Watch trailer on YouTube"
                >
                  <Play className={`shrink-0 ${linkIconClass}`} aria-hidden />
                  Trailer
                </a>
              ) : null}
              {movie.imdbId ? (
                <a
                  href={`${IMDB_TITLE_BASE}/${movie.imdbId}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${linkTextBase} ${isFeatured ? 'text-sm' : 'text-xs'}`}
                  title="View on IMDB"
                >
                  <ExternalLink className={linkIconClass} aria-hidden />
                  IMDB
                </a>
              ) : null}
              {showStreamingUi ? (
                <button
                  type="button"
                  id={streamingTriggerId}
                  aria-expanded={streamingOpen}
                  aria-controls={streamingPanelId}
                  onClick={() => void toggleStreaming()}
                  className={`${linkTextBase} ${isFeatured ? 'text-sm' : 'text-xs'} cursor-pointer bg-transparent border-none p-0 font-inherit`}
                  title="Streaming availability (US)"
                >
                  Streaming
                  <ChevronDown
                    className={`shrink-0 ${linkIconClass} transition-transform duration-200 ${
                      streamingOpen ? 'rotate-180' : ''
                    }`}
                    aria-hidden
                  />
                </button>
              ) : null}
            </div>
            {streamingOpen && showStreamingUi ? (
              <div
                id={streamingPanelId}
                role="region"
                aria-labelledby={streamingTriggerId}
                className={`mt-2 rounded-md border border-brass/40 bg-cherry-950/80 px-3 py-2 ${isFeatured ? 'text-sm' : 'text-xs'} text-cream/95`}
              >
                {providersLoading ? (
                  <p className="text-antique italic">Loading streaming…</p>
                ) : providersError ? (
                  <p className="text-amber-400/95">{providersError}</p>
                ) : providersPayload ? (
                  <StreamingProvidersDetail
                    payload={providersPayload}
                    linkTextBase={linkTextBase}
                    linkIconClass={linkIconClass}
                    isFeatured={isFeatured}
                  />
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </motion.article>
  );
}
