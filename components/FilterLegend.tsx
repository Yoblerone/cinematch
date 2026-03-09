'use client';

import { RankIcon, FilterIcon } from './FilterTypeIcon';

export default function FilterLegend({ className }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-cherry-600 ${className ?? ''}`} role="presentation">
      <span className="flex items-center gap-1.5">
        <RankIcon />
        <span>Rank only</span>
      </span>
      <span className="flex items-center gap-1.5">
        <FilterIcon />
        <span>Filters out</span>
      </span>
    </div>
  );
}
