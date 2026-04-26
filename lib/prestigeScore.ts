/**
 * Prestige scoring for cast / director sliders — not raw TMDB popularity or revenue.
 * Uses filmography breadth (unique film credits), truth-list “icons,” and billing order.
 */

import type { Movie } from './types';
import type { ProminenceTruthList } from './prominence';

const MAJOR_CREDITS = 5;

/** Below this many credited films → “Fresh Faces” band. */
export function mixIconWeight(slider: number): number {
  /** 0–30 → fresh; 70–100 → icons; 50 → even blend. */
  return Math.max(0, Math.min(1, (slider - 30) / 40));
}

function isTruthActor(id: number, name: string, list: ProminenceTruthList): boolean {
  return list.a_list_actors.some((a) => a.id === id || a.name === name);
}

function isTruthDirector(id: number, name: string, list: ProminenceTruthList): boolean {
  return list.elite_directors.some((d) => d.id === id || d.name === name);
}

/** Higher = better “fresh face” fit (fewer major credits). */
export function freshFaceScore(filmCount: number): number {
  const c = Math.max(0, filmCount);
  if (c < MAJOR_CREDITS) return 100 - c * 12;
  return Math.max(0, 88 - (c - MAJOR_CREDITS) * 3);
}

/**
 * “Icons”: award-style career depth + lead billing in prestige cinema (truth list + deep filmography + top billing).
 */
export function iconPedigreeScore(
  filmCount: number,
  order: number | undefined,
  isTruth: boolean,
  role: 'cast' | 'director'
): number {
  if (isTruth) return 96;
  const c = Math.max(0, filmCount);
  let base = 32;
  if (c >= 50) base = 94;
  else if (c >= 40) base = 88;
  else if (c >= 30) base = 82;
  else if (c >= 22) base = 74;
  else if (c >= 15) base = 66;
  else if (c >= 10) base = 58;
  else if (c >= MAJOR_CREDITS) base = 48;
  let bonus = 0;
  if (order != null && order <= 2) bonus += 12;
  if (order != null && order <= 1) bonus += 6;
  if (order === 0) bonus += 8;
  if (role === 'director') bonus += 6;
  return Math.min(100, base + bonus);
}

function blendPerson(
  filmCount: number,
  order: number | undefined,
  isTruth: boolean,
  role: 'cast' | 'director',
  slider: number
): number {
  const w = mixIconWeight(slider);
  const fresh = freshFaceScore(filmCount);
  const icon = iconPedigreeScore(filmCount, order, isTruth, role);
  return (1 - w) * fresh + w * icon;
}

function topLeads(movie: Movie): NonNullable<Movie['castCredits']> {
  const raw = movie.castCredits ?? [];
  const sorted = [...raw].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  /** Top three billed (TMDB `order`); Star Power / prestige weighting focuses on leads, not deep cast. */
  return sorted.slice(0, 3);
}

/**
 * Single-axis prestige match 0–100 for cast (top three billing) or director.
 */
export function prestigeCastMatch(movie: Movie, slider: number, truthList: ProminenceTruthList): number {
  const leads = topLeads(movie);
  const counts = movie.castLeadFilmographyCounts ?? [];
  if (leads.length === 0) return 50;
  const scores = leads.map((c, idx) => {
    const n = counts[idx] ?? 0;
    const truth = isTruthActor(c.id, c.name, truthList);
    return blendPerson(n, c.order, truth, 'cast', slider);
  });
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

export function prestigeDirectorMatch(movie: Movie, slider: number, truthList: ProminenceTruthList): number {
  const director = (movie.crewCredits ?? []).find((m) => m.job === 'Director');
  const n = movie.directorFilmographyCount ?? 0;
  if (!director) return 50;
  const truth = isTruthDirector(director.id, director.name, truthList);
  return blendPerson(n, 0, truth, 'director', slider);
}
