'use client';

import { motion } from 'framer-motion';
import { Star, ExternalLink } from 'lucide-react';
import type { Movie } from '@/lib/types';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const IMDB_TITLE_BASE = 'https://www.imdb.com/title';

interface MovieCardProps {
  movie: Movie;
  index: number;
  variant?: 'featured' | 'compact';
}

export default function MovieCard({ movie, index, variant = 'compact' }: MovieCardProps) {
  const isFeatured = variant === 'featured';
  const posterUrl = movie.posterPath
    ? `${TMDB_IMAGE_BASE}/${isFeatured ? 'w500' : 'w342'}${movie.posterPath}`
    : null;
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
          isFeatured ? 'h-56 sm:h-64' : 'h-32'
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
          <div className="flex items-center gap-1 shrink-0 text-neon-gold" title="Rating">
            <Star className={isFeatured ? 'w-5 h-5' : 'w-4 h-4'} fill="currentColor" aria-hidden />
            <span className={`font-semibold tabular-nums ${isFeatured ? 'text-lg' : 'text-sm'}`}>
              {movie.rating.toFixed(1)}
            </span>
          </div>
        </div>
        <p className={`text-cream ${isFeatured ? 'text-sm mt-1' : 'text-xs mt-0.5'}`}>
          {movie.year}
        </p>
        <p
          className={`text-cream/90 italic ${isFeatured ? 'text-sm mt-2' : 'text-xs mt-1'} line-clamp-2`}
        >
          &ldquo;{movie.tagline}&rdquo;
        </p>
        {movie.imdbId && (
          <a
            href={`${IMDB_TITLE_BASE}/${movie.imdbId}/`}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1 text-brass hover:text-neon-gold transition-colors mt-2 ${isFeatured ? 'text-sm' : 'text-xs'}`}
            title="View on IMDB"
          >
            <ExternalLink className={isFeatured ? 'w-3.5 h-3.5' : 'w-3 h-3'} aria-hidden />
            IMDB
          </a>
        )}
      </div>
    </motion.article>
  );
}
