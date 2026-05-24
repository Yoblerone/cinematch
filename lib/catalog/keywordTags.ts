import type { Genre, Soundtrack, Theme, VisualStyle } from '@/lib/types';
import { GENRE_ID_TO_NAME } from '@/lib/tmdb';

export function deriveSlidersFromMetadata(
  genreIds: number[],
  keywordNames: string[]
): {
  narrative_pacing: number;
  emotional_tone: number;
  brain_power: number;
  visual_style: number;
  suspense_level: number;
  world_style: number;
} {
  let narrative_pacing = 50;
  let emotional_tone = 50;
  let brain_power = 50;
  let visual_style = 50;
  let suspense_level = 50;
  let world_style = 50;
  const kw = keywordNames.join(' ').toLowerCase();

  if (genreIds.includes(28) || genreIds.includes(12)) narrative_pacing += 18;
  if (genreIds.includes(18) || genreIds.includes(10749)) emotional_tone += 18;
  if (genreIds.includes(9648) || genreIds.includes(878)) brain_power += 16;
  if (genreIds.includes(12) || genreIds.includes(14) || genreIds.includes(878)) visual_style += 18;
  if (genreIds.includes(53) || genreIds.includes(27)) suspense_level += 22;
  if (genreIds.includes(18) || genreIds.includes(99)) world_style += 12;

  if (kw.includes('slow') || kw.includes('meditative')) narrative_pacing -= 20;
  if (kw.includes('fast') || kw.includes('kinetic')) narrative_pacing += 16;
  if (kw.includes('grief') || kw.includes('loss') || kw.includes('tragedy')) emotional_tone += 20;
  if (kw.includes('philosoph') || kw.includes('mind') || kw.includes('existential')) brain_power += 18;
  if (kw.includes('epic') || kw.includes('spectacle')) visual_style += 18;
  if (kw.includes('suspense') || kw.includes('thriller')) suspense_level += 20;
  if (kw.includes('surreal') || kw.includes('fantasy') || kw.includes('dream')) world_style -= 18;
  if (kw.includes('realism') || kw.includes('true story')) world_style += 20;

  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
  return {
    narrative_pacing: clamp(narrative_pacing),
    emotional_tone: clamp(emotional_tone),
    brain_power: clamp(brain_power),
    visual_style: clamp(visual_style),
    suspense_level: clamp(suspense_level),
    world_style: clamp(world_style),
  };
}

function keywordToThemes(name: string): Theme[] {
  const themes: Theme[] = [];
  const n = name.toLowerCase();
  const themeMap: [string, Theme][] = [
    ['cult', 'Cult Classic'],
    ['revenge', 'Adrenaline'],
    ['action', 'Adrenaline'],
    ['twist ending', 'Twist Ending'],
    ['based on true story', 'Based on True Story'],
    ['surreal', 'Surreal'],
    ['melancholy', 'Melancholy'],
  ];
  for (const [key, theme] of themeMap) {
    if (n.includes(key)) themes.push(theme);
  }
  return themes;
}

function keywordToVisualStyles(name: string): VisualStyle[] {
  const n = name.toLowerCase();
  if (n.includes('noir')) return ['Noir Shadows'];
  if (n.includes('neon') || n.includes('cyberpunk')) return ['Neon Dystopia'];
  return [];
}

function keywordToSoundtracks(name: string): Soundtrack[] {
  const n = name.toLowerCase();
  if (n.includes('orchestral')) return ['Sweeping Orchestral'];
  if (n.includes('jazz')) return ['Jazz'];
  return [];
}

export function tagsFromKeywords(keywordNames: string[]): {
  theme: Theme[];
  visualStyle: VisualStyle[];
  soundtrack: Soundtrack[];
} {
  const theme: Theme[] = [];
  const visualStyle: VisualStyle[] = [];
  const soundtrack: Soundtrack[] = [];
  const seenT = new Set<Theme>();
  const seenV = new Set<VisualStyle>();
  const seenS = new Set<Soundtrack>();
  for (const name of keywordNames) {
    for (const t of keywordToThemes(name)) {
      if (!seenT.has(t)) {
        seenT.add(t);
        theme.push(t);
      }
    }
    for (const v of keywordToVisualStyles(name)) {
      if (!seenV.has(v)) {
        seenV.add(v);
        visualStyle.push(v);
      }
    }
    for (const s of keywordToSoundtracks(name)) {
      if (!seenS.has(s)) {
        seenS.add(s);
        soundtrack.push(s);
      }
    }
  }
  return { theme, visualStyle, soundtrack };
}

export function genresFromIds(genreIds: number[]): Genre[] {
  return genreIds
    .map((id) => GENRE_ID_TO_NAME[id])
    .filter((g): g is Genre => g != null);
}

export function criticsVsFansLabel(voteAverage: number, voteCount: number): 'critics' | 'fans' | 'both' {
  if (voteCount >= 5000 && voteAverage >= 7.8) return 'critics';
  if (voteCount >= 10000) return 'fans';
  return 'both';
}
