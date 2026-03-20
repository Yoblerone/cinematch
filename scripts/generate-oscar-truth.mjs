#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const fetchedPath = 'C:/Users/Yoni Shapiro/.cursor/projects/d-Cinematch-cinematch/agent-tools/6c03d0e3-d71f-4753-ae54-d2cd6a421dda.txt';
if (!existsSync(fetchedPath)) {
  console.error('Missing fetched wiki file:', fetchedPath);
  process.exit(1);
}

function loadApiKey() {
  if (process.env.TMDB_API_KEY) return process.env.TMDB_API_KEY;
  const envPath = join(root, '.env.local');
  if (!existsSync(envPath)) return null;
  const text = readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*TMDB_API_KEY\s*=\s*(.+)\s*$/);
    if (m) return m[1].trim().replace(/^['"]|['"]$/g, '');
  }
  return null;
}

const apiKey = loadApiKey();
if (!apiKey) {
  console.error('TMDB_API_KEY not found in env or .env.local');
  process.exit(1);
}

function parseEntries(markdown) {
  const lines = markdown.split('\n');
  let started = false;
  let currentYear = null;
  const yearSeen = new Set();
  const entries = [];

  for (const ln of lines) {
    if (ln.startsWith('## Winners and nominees')) {
      started = true;
      continue;
    }
    if (started && ln.startsWith('## ') && !ln.startsWith('### ')) break;
    if (!started || !ln.startsWith('|')) continue;

    const cols = ln.split('|').map((c) => c.trim());
    if (cols.length < 4) continue;
    const c1 = cols[1];
    const c2 = cols[2];
    if (!c1 || !c2 || c1 === '---' || c2 === '---') continue;

    const ym = c1.match(/\[(\d{4}(?:\/\d{2})?)\]/);
    let filmCell = c1;
    if (ym) {
      currentYear = Number(ym[1].split('/')[0]);
      filmCell = c2;
    }
    if (!currentYear) continue;

    const tm = filmCell.match(/\[([^\]]+)\]\(/);
    if (!tm) continue;
    const title = tm[1].trim();
    if (title.toLowerCase().startsWith('year of film release')) continue;

    const key = `${currentYear}::${title.toLowerCase()}`;
    const won = !yearSeen.has(currentYear);
    entries.push({ year: currentYear, title, won, _key: key });
    if (won) yearSeen.add(currentYear);
  }

  const manual = [
    { year: 2026, title: 'One Battle After Another', won: true },
    { year: 2026, title: 'Sinners', won: false },
    { year: 2025, title: 'Anora', won: true },
  ];

  const byKey = new Map();
  for (const e of entries) byKey.set(e._key, e);
  for (const m of manual) byKey.set(`${m.year}::${m.title.toLowerCase()}`, { ...m, _key: `${m.year}::${m.title.toLowerCase()}` });
  return [...byKey.values()].map(({ _key, ...rest }) => rest);
}

function norm(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function scoreResult(targetTitle, targetYear, result) {
  const title = String(result.title || '');
  const nTarget = norm(targetTitle);
  const nTitle = norm(title);
  let score = 0;
  if (nTitle === nTarget) score += 100;
  else if (nTitle.includes(nTarget) || nTarget.includes(nTitle)) score += 50;

  const date = String(result.release_date || '');
  const year = /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : 0;
  if (year === targetYear) score += 30;
  else if (year && Math.abs(year - targetYear) === 1) score += 10;

  score += Math.min(20, Math.floor(Number(result.popularity || 0) / 10));
  return score;
}

async function resolveTmdbId(title, year) {
  const url1 = `https://api.themoviedb.org/3/search/movie?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(title)}&primary_release_year=${year}&include_adult=false`;
  const r1 = await fetch(url1);
  const d1 = await r1.json();
  let candidates = Array.isArray(d1.results) ? d1.results : [];
  if (candidates.length === 0) {
    const url2 = `https://api.themoviedb.org/3/search/movie?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(title)}&include_adult=false`;
    const r2 = await fetch(url2);
    const d2 = await r2.json();
    candidates = Array.isArray(d2.results) ? d2.results : [];
  }
  if (candidates.length === 0) return 0;

  candidates.sort((a, b) => scoreResult(title, year, b) - scoreResult(title, year, a));
  return Number(candidates[0]?.id || 0);
}

const markdown = readFileSync(fetchedPath, 'utf8');
const parsed = parseEntries(markdown);
parsed.sort((a, b) => (b.year - a.year) || (a.won === b.won ? a.title.localeCompare(b.title) : (a.won ? -1 : 1)));

const resolved = [];
for (let i = 0; i < parsed.length; i++) {
  const e = parsed[i];
  const tmdb_id = await resolveTmdbId(e.title, e.year);
  resolved.push({ ...e, tmdb_id });
  if ((i + 1) % 50 === 0) console.log(`Resolved ${i + 1}/${parsed.length}`);
}

// Deduplicate by TMDB id (keeps most recent year; if same year, winner row wins).
const dedupByTmdb = new Map();
for (const r of resolved) {
  if (!r.tmdb_id) continue;
  const prev = dedupByTmdb.get(r.tmdb_id);
  if (!prev) {
    dedupByTmdb.set(r.tmdb_id, r);
    continue;
  }
  if (r.year > prev.year) dedupByTmdb.set(r.tmdb_id, r);
  else if (r.year === prev.year && r.won && !prev.won) dedupByTmdb.set(r.tmdb_id, r);
}

const finalRows = [...dedupByTmdb.values()];
finalRows.sort((a, b) => (b.year - a.year) || (a.won === b.won ? 0 : (a.won ? -1 : 1)) || a.title.localeCompare(b.title));

const outPath = join(root, 'lib', 'data', 'oscar-truth.ts');
const lines = finalRows.map((e) => `  { year: ${e.year}, title: '${e.title.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', tmdb_id: ${e.tmdb_id}, won: ${e.won ? 'true' : 'false'} },`);

const content = `/**
 * Oscars (Best Picture) source of truth from web table + TMDB resolution.
 * Generated by scripts/generate-oscar-truth.mjs.
 */

export type OscarTruthEntry = {
  year: number;
  title: string;
  tmdb_id: number;
  won: boolean;
};

export const OSCAR_RESULTS: OscarTruthEntry[] = [
${lines.join('\n')}
];

const byId = new Map<number, OscarTruthEntry>();
for (const e of OSCAR_RESULTS) byId.set(e.tmdb_id, e);

function sorted(entries: OscarTruthEntry[]): OscarTruthEntry[] {
  return [...entries].sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    if (a.won !== b.won) return a.won ? -1 : 1;
    return a.title.localeCompare(b.title);
  });
}

export function getOscarWinnerIds(): number[] {
  return sorted(OSCAR_RESULTS.filter((e) => e.won)).map((e) => e.tmdb_id);
}

export function getOscarNomineeIds(): number[] {
  return sorted(OSCAR_RESULTS.filter((e) => !e.won)).map((e) => e.tmdb_id);
}

export function getOscarBothIds(): number[] {
  return sorted(OSCAR_RESULTS).map((e) => e.tmdb_id);
}

export function isOscarWinnerId(id: number): boolean {
  return byId.get(id)?.won === true;
}

export function isOscarNomineeId(id: number): boolean {
  return byId.get(id)?.won === false;
}

export function isOscarListedId(id: number): boolean {
  return byId.has(id);
}

export function getOscarAwardInfo(id: number): { year: number; type: 'Winner' | 'Nominee' } | null {
  const e = byId.get(id);
  if (!e) return null;
  return { year: e.year, type: e.won ? 'Winner' : 'Nominee' };
}
`;

writeFileSync(outPath, content, 'utf8');
console.log(`Wrote ${outPath} with ${finalRows.length} deduped entries.`);
