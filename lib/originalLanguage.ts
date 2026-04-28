/**
 * Original-language chips + World Cinema fan-out pool (TMDB `with_original_language`).
 */

import type { CuratedOriginalLanguageCode, OriginalLanguageChoice } from './types';

/** Nine selectable curated languages (non-English); English is default (`originalLanguage: null`). */
export const CURATED_ORIGINAL_LANGUAGE_OPTIONS: readonly {
  code: CuratedOriginalLanguageCode;
  label: string;
}[] = [
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'zh', label: 'Chinese' },
  { code: 'hi', label: 'Hindi' },
];

export const CURATED_ORIGINAL_LANGUAGE_CODES = CURATED_ORIGINAL_LANGUAGE_OPTIONS.map((o) => o.code);

const CURATED_SET = new Set<string>(CURATED_ORIGINAL_LANGUAGE_CODES);

/**
 * World Cinema fan-out pool — excludes curated chips; includes ru, tr and long-tail ISO codes with usable TMDB depth.
 */
export const WORLD_CINEMA_FANOUT_LANGUAGE_CODES: readonly string[] = [
  'ru',
  'tr',
  'ar',
  'sv',
  'nl',
  'da',
  'pl',
  'fi',
  'no',
  'cs',
  'hu',
  'ro',
  'bg',
  'el',
  'he',
  'fa',
  'uk',
  'id',
  'th',
  'vi',
  'ms',
  'tl',
  'bn',
  'ta',
  'te',
  'ml',
  'kn',
  'mr',
  'uz',
  'kk',
  'ka',
  'sr',
  'sk',
  'hr',
  'sl',
  'lt',
  'lv',
  'et',
  'is',
  'ca',
  'eu',
  'gl',
  'sq',
  'mk',
  'hy',
  'az',
  'sw',
  'af',
];

export function normalizeOriginalLanguageCode(lang: string | null | undefined): string {
  if (lang == null || typeof lang !== 'string') return '';
  const x = lang.toLowerCase().trim();
  if (x.startsWith('zh')) return 'zh';
  return x.slice(0, 2);
}

export function isCuratedChipOriginalLanguage(lang: string | null | undefined): boolean {
  const n = normalizeOriginalLanguageCode(lang);
  return n !== '' && CURATED_SET.has(n);
}

/** Normalize legacy/API payloads; `'en'` means default (no filter). */
export function normalizeOriginalLanguageFilterInput(raw: unknown): OriginalLanguageChoice {
  if (raw == null || raw === '') return null;
  if (typeof raw !== 'string') return null;
  const t = raw.trim().toLowerCase();
  if (t === '' || t === 'en') return null;
  if (t === 'world-cinema') return 'world-cinema';
  const code = t.startsWith('zh') ? 'zh' : t.slice(0, 2);
  if (CURATED_SET.has(code)) return code as CuratedOriginalLanguageCode;
  return null;
}

/** Session restore: prefers stored `originalLanguage` when set; migrates legacy `originCountry`. */
export function coerceOriginalLanguageFromSession(
  raw: Partial<{ originalLanguage?: unknown; originCountry?: unknown }>
): OriginalLanguageChoice {
  const ol = raw.originalLanguage;
  /** Distinguish “missing / default null” (merge with defaultFilters) from an explicit chip choice. */
  const meaningfulOl =
    ol !== undefined &&
    ol !== null &&
    !(typeof ol === 'string' && ol.trim() === '');

  if (meaningfulOl) {
    return normalizeOriginalLanguageFilterInput(ol);
  }
  if (raw.originCountry === 'international-nonenglish') return 'world-cinema';
  if (raw.originCountry === 'international-english') return null;
  return normalizeOriginalLanguageFilterInput(ol ?? null);
}
export function formatOriginalLanguageCsvLabel(choice: OriginalLanguageChoice): string | null {
  if (choice == null) return null;
  if (choice === 'world-cinema') return 'World Cinema';
  const row = CURATED_ORIGINAL_LANGUAGE_OPTIONS.find((o) => o.code === choice);
  return row?.label ?? choice;
}

export function filterMoviesForOriginalLanguageChoice<T extends { originalLanguage?: string | null }>(
  movies: T[],
  choice: OriginalLanguageChoice
): T[] {
  if (choice == null) return movies;
  if (choice === 'world-cinema') {
    return movies.filter((m) => !isCuratedChipOriginalLanguage(m.originalLanguage ?? null));
  }
  const want = normalizeOriginalLanguageCode(choice);
  return movies.filter((m) => normalizeOriginalLanguageCode(m.originalLanguage ?? '') === want);
}
