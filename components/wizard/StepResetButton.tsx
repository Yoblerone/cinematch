'use client';

import { RotateCcw } from 'lucide-react';

interface StepResetButtonProps {
  onReset: () => void;
  /** Accessible label / tooltip */
  label?: string;
}

/** Subtle gold reset for current wizard step only. */
export default function StepResetButton({
  onReset,
  label = 'Clear selections on this step',
}: StepResetButtonProps) {
  return (
    <div className="mt-2 mb-1 flex w-full justify-center">
      <button
        type="button"
        onClick={onReset}
        className="p-1.5 text-brass-light hover:text-neon-gold transition-colors"
        aria-label={label}
        title={label}
      >
        <RotateCcw className="w-4 h-4" aria-hidden />
      </button>
    </div>
  );
}
