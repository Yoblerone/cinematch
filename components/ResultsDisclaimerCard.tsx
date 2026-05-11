'use client';

import { motion } from 'framer-motion';
import { Clapperboard } from 'lucide-react';
import type { ResultsDisclaimer } from '@/lib/types';

const HINT_LABEL: Record<string, string> = {
  runtime: 'runtime',
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
            <p className="mt-1.5 text-xs leading-snug text-cream/85 sm:text-sm">
              Try relaxing your{' '}
              <span className="font-medium text-neon-gold/90">{specific}</span>{' '}
              {summary.length > 1 ? 'filters' : 'filter'} for better results. The rest of this grid
              is our next-best lineup
            </p>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
