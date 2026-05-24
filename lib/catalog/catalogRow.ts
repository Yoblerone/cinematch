/** Supabase `movies` table row (seed / daily sync). */
export type CatalogMovieRow = {
  tmdb_id: number;
  title: string;
  original_title?: string | null;
  overview: string;
  tagline?: string | null;
  release_date?: string | null;
  runtime_minutes?: number | null;
  original_language?: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
  budget?: number;
  revenue?: number;
  collection_id?: number | null;
  collection_name?: string | null;
  poster_path?: string | null;
  imdb_id?: string | null;
  trailer_youtube_key?: string | null;
  genre_ids: number[];
  genre_names?: string[];
  keyword_ids?: number[];
  keyword_names?: string[];
  credits?: {
    cast?: { id: number; name: string; popularity?: number; order?: number }[];
    crew?: { id: number; name: string; job: string; popularity?: number }[];
  } | null;
  belongs_to_collection?: { id: number; name: string } | null;
  watch_providers?: Record<string, unknown> | null;
};
