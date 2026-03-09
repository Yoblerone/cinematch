'use client';

import { motion } from 'framer-motion';

// Realistic popcorn kernel: irregular puffed shape with lobes (butterfly / cloud)
function PopcornKernelSvg({ size, className }: { size: number; className?: string }) {
  const s = size;
  return (
    <svg
      width={s}
      height={s * 1.1}
      viewBox="0 0 44 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {/* Main puffed body - irregular popcorn shape with bumps */}
      <path
        d="M22 4c3 2 6 6 7 12 1 4 0 9-2 13-1 2-3 4-5 5-4 2-8 2-12 0-2-1-4-3-5-6-1-4 0-8 2-11 2-3 6-5 10-6 2 0 4-1 5-2 2-2 2-5 0-4z"
        fill="currentColor"
      />
      <path
        d="M22 8c2 3 3 7 2 10-1 2-3 4-5 4-2 0-4-2-4-4 0-2 1-4 3-6 1-1 3-2 4-2 0 0 0-2-1-2z"
        fill="currentColor"
        opacity="0.9"
      />
      {/* Left lobe */}
      <path
        d="M10 22c-1 2 0 5 2 6 2 1 4 0 5-2 1-2 0-4-2-5-2-1-3 0-3 1z"
        fill="currentColor"
        opacity="0.85"
      />
      {/* Right lobe */}
      <path
        d="M34 22c1 2 0 5-2 6-2 1-4 0-5-2-1-2 0-4 2-5 2-1 3 0 3 1z"
        fill="currentColor"
        opacity="0.85"
      />
      {/* Top bump */}
      <path
        d="M20 10c0 2 1 3 2 3 1 0 2-1 2-3 0-1-1-2-2-2s-2 1-2 2z"
        fill="currentColor"
        opacity="0.75"
      />
    </svg>
  );
}

const BITS: { top?: string; bottom?: string; left?: string; right?: string; stepVisible: number; size: number }[] = [
  { top: '5%', left: '3%', stepVisible: 1, size: 36 },
  { top: '10%', right: '5%', stepVisible: 1, size: 44 },
  { top: '14%', left: '10%', stepVisible: 1, size: 32 },
  { bottom: '36%', left: '1%', stepVisible: 2, size: 40 },
  { bottom: '42%', right: '4%', stepVisible: 2, size: 36 },
  { top: '46%', left: '0%', stepVisible: 2, size: 32 },
  { top: '52%', right: '3%', stepVisible: 2, size: 44 },
  { bottom: '26%', left: '8%', stepVisible: 3, size: 36 },
  { bottom: '30%', right: '10%', stepVisible: 3, size: 40 },
  { top: '22%', left: '5%', stepVisible: 3, size: 32 },
  { top: '36%', right: '2%', stepVisible: 3, size: 36 },
  { top: '66%', right: '5%', stepVisible: 4, size: 40 },
  { bottom: '56%', left: '5%', stepVisible: 4, size: 32 },
  { top: '42%', right: '8%', stepVisible: 4, size: 36 },
  { bottom: '16%', left: '6%', stepVisible: 4, size: 44 },
  { top: '76%', left: '7%', stepVisible: 4, size: 32 },
];

function PopcornBit({
  style,
  stepVisible,
  currentStep,
  i,
  size,
}: {
  style: React.CSSProperties;
  stepVisible: number;
  currentStep: number;
  i: number;
  size: number;
}) {
  const show = currentStep >= stepVisible;
  return (
    <motion.span
      aria-hidden
      className="absolute pointer-events-none select-none text-amber-100"
      style={{
        ...style,
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))',
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={show ? { scale: 1, opacity: 0.92 } : { scale: 0, opacity: 0 }}
      transition={{
        type: 'spring',
        stiffness: 280,
        damping: 16,
        delay: show ? i * 0.05 : 0,
      }}
    >
      <PopcornKernelSvg size={size} />
    </motion.span>
  );
}

export default function PopcornScatter({ currentStep }: { currentStep: number }) {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {BITS.map((pos, i) => (
        <PopcornBit
          key={i}
          i={i}
          currentStep={currentStep}
          stepVisible={pos.stepVisible}
          size={pos.size}
          style={{
            top: pos.top,
            bottom: pos.bottom,
            left: pos.left,
            right: pos.right,
          }}
        />
      ))}
    </div>
  );
}
