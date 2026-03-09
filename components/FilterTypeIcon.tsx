'use client';

import { ArrowUpDown, Filter } from 'lucide-react';

/** Green = rank only; Blue = filters out. */
export function RankIcon({ className }: { className?: string }) {
  return (
    <span className={`inline-flex text-neon-green drop-shadow-[0_0_8px_rgba(57,255,20,0.8)] ${className ?? ''}`} title="Affects ranking only">
      <ArrowUpDown className="w-3.5 h-3.5" aria-hidden />
    </span>
  );
}

export function FilterIcon({ className }: { className?: string }) {
  return (
    <span className={`inline-flex text-neon-blue drop-shadow-[0_0_8px_rgba(0,212,255,0.8)] ${className ?? ''}`} title="Filters out non-matching results">
      <Filter className="w-3.5 h-3.5" aria-hidden />
    </span>
  );
}
