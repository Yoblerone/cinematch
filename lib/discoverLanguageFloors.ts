/** Vote-count / rating floors for TMDB Discover — language-tier tuning only (no scorer logic). */

export type LanguageTier = 'tier_a' | 'tier_b' | 'tier_c';

/** Nine selectable curated picks — large catalogs on TMDB. */
const TIER_A_ISO = new Set([
  'ja',
  'ko',
  'fr',
  'es',
  'de',
  'it',
  'pt',
  'zh',
  'hi',
]);

export function tierForOriginalLanguageIso(iso: string): LanguageTier {
  const raw = iso.trim().toLowerCase();
  if (raw === 'world-cinema') return 'tier_c';
  const x = raw.startsWith('zh') ? 'zh' : raw.slice(0, 2);
  if (x.length >= 2 && TIER_A_ISO.has(x)) return 'tier_a';
  return 'tier_b';
}

/**
 * Mutates only `voteCountGte` and `voteAverageGte`.
 * Tier A: temporary fixed floor while validating `with_original_language` — tune after QA.
 * Tier B: rare ISO paths outside curated chips — modest relaxation vs baseline.
 * Tier C: World Cinema fan-out — lowest vote floor + rating guard.
 */
export function applyTieredVoteFloorsToDiscoverParams(
  params: { voteCountGte?: number; voteAverageGte?: number },
  tier: LanguageTier
): void {
  const baseline = Math.max(1, params.voteCountGte ?? 500);

  if (tier === 'tier_a') {
    params.voteCountGte = 50;
    return;
  }

  if (tier === 'tier_b') {
    params.voteCountGte = Math.max(35, Math.floor(baseline * 0.65));
    return;
  }

  params.voteCountGte = Math.max(25, Math.floor(baseline * 0.35));
  params.voteAverageGte = Math.max(params.voteAverageGte ?? 0, 6.5);
}
