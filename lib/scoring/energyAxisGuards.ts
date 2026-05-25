import type { FilterState, Movie } from '@/lib/types';
import {
  nearestFilterWeightStop,
  FILTER_WEIGHT_HIGH,
  FILTER_WEIGHT_LOW,
  FILTER_WEIGHT_MED,
} from '@/lib/filterWeightSegments';
import { buildEnergyHaystack, scoreKeywordTier } from '@/lib/scoring/thematicDensity';
import { ENERGY_MANIFEST, type EnergyManifestAxis } from '@/lib/scoring/energyManifest';

export const ENERGY_GUARD_AXES: EnergyManifestAxis[] = [
  'narrative_pacing',
  'emotional_tone',
  'brain_power',
  'visual_style',
  'suspense_level',
  'world_style',
];

type AxisGuardCopy = {
  highConstraint?: string;
  lowConstraint?: string;
  midConstraint?: string;
};

const AXIS_CLAUDE_GUARDS: Record<EnergyManifestAxis, AxisGuardCopy> = {
  narrative_pacing: {
    highConstraint:
      ' PACING (critical): Prefer propulsive, urgent, chase/heist/thriller energy. EXCLUDE slow-burn meditative character studies as top picks.',
    lowConstraint:
      ' PACING (critical): Prefer patient, meditative, character-driven pacing. EXCLUDE non-stop action blockbusters and pure chase films as top picks.',
  },
  emotional_tone: {
    highConstraint:
      ' EMOTIONAL TONE (critical): Prefer heavy, grief-laden, tragic, or devastating drama. EXCLUDE light feel-good comedies and breezy rom-coms.',
    lowConstraint:
      ' EMOTIONAL TONE (critical): Prefer light, fun, uplifting, heartwarming tone. EXCLUDE bleak tragedy and grief-heavy weepies as top picks.',
  },
  brain_power: {
    highConstraint:
      ' BRAIN POWER (critical): Prefer philosophical, cerebral, ambiguous, thought-provoking films. EXCLUDE mindless spectacle-only action.',
    lowConstraint:
      ' BRAIN POWER (critical): Prefer escapist, accessible entertainment. EXCLUDE dense existential philosophy essays as top picks.',
  },
  visual_style: {
    highConstraint:
      ' VISUAL STYLE (critical): Prefer epic scale, spectacle, sweeping cinematography. EXCLUDE lo-fi raw minimalist aesthetics as top picks.',
    lowConstraint:
      ' VISUAL STYLE (critical): Prefer intimate, raw, naturalistic visuals. EXCLUDE pure blockbuster spectacle as top picks.',
    midConstraint:
      ' VISUAL STYLE: Prefer distinctive cinematic craft — not flat TV look, not only mega-blockbuster VFX.',
  },
  suspense_level: {
    highConstraint:
      ' SUSPENSE (critical): Prefer tense, dangerous, thriller/horror pressure. EXCLUDE cozy low-stakes slice-of-life.',
    lowConstraint:
      ' SUSPENSE (critical): Prefer relaxed, safe, low-threat stories. EXCLUDE horror/thriller pressure-cooker films as top picks.',
  },
  world_style: {
    highConstraint:
      ' WORLD STYLE (critical): Prefer surreal, dreamlike, mythic, or overtly fantastical worlds. EXCLUDE straight docudrama realism.',
    lowConstraint:
      ' WORLD STYLE (critical): Must feel grounded and realistic. EXCLUDE portal fantasies, fairy-tale realms, and spirit-world fables (e.g. Narnia, Wonderland, Princess Mononoke) unless overwhelmingly realistic.',
    midConstraint:
      ' WORLD STYLE: Stylized heightened reality OK; not pure fairy-tale surrealism nor dry docudrama unless it fits.',
  },
};

/** Claude prompt addendum for every active Low/High/Mid energy slider. */
export function buildEnergyAxisConstraints(filters: FilterState): string {
  let out = '';
  for (const axis of ENERGY_GUARD_AXES) {
    const raw = filters[axis];
    if (raw == null) continue;
    const stop = nearestFilterWeightStop(raw);
    const copy = AXIS_CLAUDE_GUARDS[axis];
    if (stop === FILTER_WEIGHT_HIGH && copy.highConstraint) out += copy.highConstraint;
    else if (stop === FILTER_WEIGHT_LOW && copy.lowConstraint) out += copy.lowConstraint;
    else if (stop === FILTER_WEIGHT_MED && copy.midConstraint) out += copy.midConstraint;
  }
  return out;
}

/** Boost when manifest primary terms match the user’s tier on an axis. */
export function sumEnergyAxisMatchBoost(movie: Movie, filters: FilterState): number {
  const haystack = buildEnergyHaystack(movie);
  let boost = 0;
  for (const axis of ENERGY_GUARD_AXES) {
    const raw = filters[axis];
    if (raw == null) continue;
    const stop = nearestFilterWeightStop(raw);
    let tier = stop === FILTER_WEIGHT_HIGH
      ? ENERGY_MANIFEST[axis].high
      : stop === FILTER_WEIGHT_LOW
        ? ENERGY_MANIFEST[axis].low
        : ENERGY_MANIFEST[axis].mid;
    if (!tier) continue;
    const { primaryRaw } = scoreKeywordTier(tier, haystack);
    if (primaryRaw >= 3) boost += 220;
    else if (primaryRaw >= 2) boost += 130;
    else if (primaryRaw >= 1) boost += 65;
  }
  return boost;
}

/** Penalize strong manifest signal on the *opposite* tier (all axes). */
export function sumEnergyAxisOpposingPenalties(movie: Movie, filters: FilterState): number {
  const haystack = buildEnergyHaystack(movie);
  let penalty = 0;
  for (const axis of ENERGY_GUARD_AXES) {
    const raw = filters[axis];
    if (raw == null) continue;
    const stop = nearestFilterWeightStop(raw);
    if (stop === FILTER_WEIGHT_HIGH) {
      const opposing = scoreKeywordTier(ENERGY_MANIFEST[axis].low, haystack);
      if (opposing.primaryRaw >= 2) penalty += 340;
      else if (opposing.primaryRaw >= 1) penalty += 200;
    } else if (stop === FILTER_WEIGHT_LOW) {
      const opposing = scoreKeywordTier(ENERGY_MANIFEST[axis].high, haystack);
      if (opposing.primaryRaw >= 1) penalty += axis === 'world_style' ? 450 : 380;
      else if (opposing.raw >= 2) penalty += 240;
    } else if (stop === FILTER_WEIGHT_MED && ENERGY_MANIFEST[axis].mid) {
      const hi = scoreKeywordTier(ENERGY_MANIFEST[axis].high, haystack);
      const lo = scoreKeywordTier(ENERGY_MANIFEST[axis].low, haystack);
      if (hi.primaryRaw >= 2 && lo.primaryRaw >= 2) penalty += 120;
    }
  }
  return penalty;
}
