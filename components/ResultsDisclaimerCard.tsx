'use client';

import { motion } from 'framer-motion';
import { Clapperboard } from 'lucide-react';
import type { ResultsDisclaimer } from '@/lib/types';
import { RESULTS_GRID_SIZE } from '@/lib/matchFinalize';

const HINT_LABEL: Record<string, string> = {
  runtime: 'runtime',
  genre: 'genre',
  language: 'language',
  'new-releases': 'New Releases',
  decade: 'decade',
  oscar: 'Best Picture',
};

function hintPhrase(summary: string[]): string {
  if (summary.length === 0) return 'a few';
  if (summary.length === 1) return summary[0]!;
  if (summary.length === 2) return `${summary[0]!} or ${summary[1]!}`;
  return `${summary[0]!}, ${summary[1]!}, or more`;
}

export default function ResultsDisclaimerCard({
  disclaimer,
  index,
}: {
  disclaimer: ResultsDisclaimer;
  index: number;
}) {
  const summary = disclaimer.hints.map((h) => HINT_LABEL[h] ?? h);
  const specific = hintPhrase(summary);
  const strict = disclaimer.strictMatchCount ?? 0;
  const filterWord = summary.length > 1 ? 'filters' : 'filter';
  const hasRelaxedFill = Boolean(disclaimer.hasRelaxedFill);

  let body: string;
  const mentionsNewReleases = disclaimer.hints.includes('new-releases');

  if (strict === 0 && mentionsNewReleases) {
    body = `No films in the last 180 days for this combo. Titles below are older picks — try relaxing ${specific} ${filterWord} for fresher matches.`;
  } else if (strict === 0) {
    body = `No perfect matches for this combo. Try relaxing your ${specific} ${filterWord} — the titles below are our closest picks.`;
  } else if (!hasRelaxedFill) {
    body = `Only ${strict} perfect match${strict === 1 ? '' : 'es'} for this combo (we aim for ${RESULTS_GRID_SIZE}). Try relaxing your ${specific} ${filterWord} in the wizard.`;
  } else if (mentionsNewReleases) {
    body = `We found ${strict} match${strict === 1 ? '' : 'es'} from the last 180 days. Below the divider are older titles — relax ${specific} ${filterWord} for a fresher grid.`;
  } else {
    body = `We found ${strict} perfect match${strict === 1 ? '' : 'es'}. Try relaxing your ${specific} ${filterWord} for a fuller grid — below are our next-best picks.`;
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="card-hover relative overflow-hidden rounded-xl border-2 border-dashed border-amber-500/50 bg-gradient-to-br from-cherry-900/95 to-cherry-950/90 shadow-[0_0_24px_rgba(184,134,11,0.12)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(184,134,11,0.08),transparent_55%)]" />
      <div className="relative flex h-full min-h-[7rem] flex-col justify-center gap-2 p-4 sm:min-h-[8rem] sm:p-5">
        <div className="flex items-start gap-2">
          <Clapperboard className="mt-0.5 h-5 w-5 shrink-0 text-amber-400/90" aria-hidden />
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-amber-200 sm:text-base">
              Oops — not a perfect match
            </p>
            <p className="mt-1.5 text-xs leading-snug text-cream/85 sm:text-sm">{body}</p>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
