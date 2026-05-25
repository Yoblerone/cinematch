/**
 * Catalog Claude rerank cost profile (one Messages API call per match when enabled).
 *
 * Typical request: ~48 candidates × ~120 chars + constraints ≈ 8–12k input tokens;
 * output capped at 1200 tokens (36-title JSON). Sonnet ≈ $0.03–0.06/search;
 * Haiku (CLAUDE_RERANK_MODEL) ≈ $0.005–0.015/search at similar token counts.
 *
 * TMDB backfill is capped separately (see MAX_CLAUDE_BACKFILL_SEARCHES) — not billed to Anthropic.
 */
export const CATALOG_CLAUDE_POOL_CAP = 48;
export const CLAUDE_RERANK_MAX_OUTPUT_TOKENS = 1200;
export const MAX_CLAUDE_BACKFILL_SEARCHES = 4;
export const CLAUDE_RERANK_KEYWORD_SNIPPETS = 8;
export const CLAUDE_RERANK_OVERVIEW_CHARS = 90;

export function claudeRerankModel(): string {
  const m = process.env.CLAUDE_RERANK_MODEL?.trim();
  return m || 'claude-sonnet-4-5';
}
