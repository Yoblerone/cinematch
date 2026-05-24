export type WatchProviderEntry = {
  provider_id: number;
  provider_name: string;
  logo_path?: string | null;
};

export type WatchProvidersPayload = {
  region: string;
  link: string | null;
  flatrate: WatchProviderEntry[];
  rent: WatchProviderEntry[];
  buy: WatchProviderEntry[];
};

/** Normalize TMDB `watch/providers.results` blob stored on catalog rows. */
export function watchProvidersForRegion(
  raw: unknown,
  region = 'US'
): WatchProvidersPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const results = raw as Record<string, unknown>;
  const bucket = results[region];
  if (!bucket || typeof bucket !== 'object') return null;
  const b = bucket as Record<string, unknown>;
  const pick = (key: string): WatchProviderEntry[] => {
    const arr = b[key];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x): x is WatchProviderEntry => {
        if (!x || typeof x !== 'object') return false;
        const row = x as WatchProviderEntry;
        return typeof row.provider_id === 'number' && typeof row.provider_name === 'string';
      })
      .map((x) => x as WatchProviderEntry);
  };
  return {
    region,
    link: typeof b.link === 'string' ? b.link : null,
    flatrate: pick('flatrate'),
    rent: pick('rent'),
    buy: pick('buy'),
  };
}
