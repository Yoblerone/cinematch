'use client';

import { motion } from 'framer-motion';

// Same realistic kernel shape as PopcornScatter
function KernelSvg({ size, className }: { size: number; className?: string }) {
  const s = size;
  return (
    <svg
      width={s}
      height={s * 1.1}
      viewBox="0 0 44 48"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M22 4c3 2 6 6 7 12 1 4 0 9-2 13-1 2-3 4-5 5-4 2-8 2-12 0-2-1-4-3-5-6-1-4 0-8 2-11 2-3 6-5 10-6 2 0 4-1 5-2 2-2 2-5 0-4z"
        fill="currentColor"
      />
      <path
        d="M22 8c2 3 3 7 2 10-1 2-3 4-5 4-2 0-4-2-4-4 0-2 1-4 3-6 1-1 3-2 4-2 0 0 0-2-1-2z"
        fill="currentColor"
        opacity="0.9"
      />
      <path
        d="M10 22c-1 2 0 5 2 6 2 1 4 0 5-2 1-2 0-4-2-5-2-1-3 0-3 1z"
        fill="currentColor"
        opacity="0.85"
      />
      <path
        d="M34 22c1 2 0 5-2 6-2 1-4 0-5-2-1-2 0-4 2-5 2-1 3 0 3 1z"
        fill="currentColor"
        opacity="0.85"
      />
      <path
        d="M20 10c0 2 1 3 2 3 1 0 2-1 2-3 0-1-1-2-2-2s-2 1-2 2z"
        fill="currentColor"
        opacity="0.75"
      />
    </svg>
  );
}

// Final positions: piled inside rectangular carton (poppy, overflowing)
const FINAL: { x: number; y: number; size: number; rotation: number }[] = [];
const cx = 50;
const cy = 50;
for (let i = 0; i < 50; i++) {
  const angle = (i / 50) * Math.PI * 2 + (i % 7) * 0.35;
  const r = 12 + (i % 10) * 2.2 + (i % 4) * 2;
  FINAL.push({
    x: cx + Math.cos(angle) * r,
    y: cy + Math.sin(angle) * r * 0.85,
    size: 14 + (i % 6) * 2.5,
    rotation: (i * 17) % 360,
  });
}
for (let i = 0; i < 18; i++) {
  FINAL.push({
    x: cx - 20 + (i % 5) * 2.5 + (i % 2) * 4,
    y: cy - 12 + (i % 4) * 3,
    size: 12 + (i % 4) * 1.5,
    rotation: (i * 31) % 360,
  });
}

// Start positions: off-screen / scattered so they "pop" in and assemble
function getStartPos(i: number) {
  const side = i % 3;
  if (side === 0) return { x: -15 - (i % 8) * 4, y: 30 + (i % 40) };
  if (side === 1) return { x: 115 + (i % 6) * 3, y: 25 + (i % 45) };
  return { x: 20 + (i % 60), y: -10 - (i % 5) * 3 };
}

const STRIPE_H = 10;

export default function PopcornBowl() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center" aria-hidden>
      {/* Classic rectangular red & white striped carton */}
      <motion.div
        className="relative opacity-95"
        style={{ width: 'min(80vw, 340px)' }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 0.95, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div
          className="relative rounded-lg overflow-visible"
          style={{
            height: 220,
            background: `repeating-linear-gradient(
              to bottom,
              #b91c1c 0,
              #b91c1c ${STRIPE_H}px,
              #fef2f2 ${STRIPE_H}px,
              #fef2f2 ${STRIPE_H * 2}px
            )`,
            clipPath: 'inset(0 0 0 0 round 12px)',
            boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.12), 0 6px 20px rgba(0,0,0,0.25)',
            border: '2px solid rgba(185, 28, 28, 0.5)',
          }}
        />
        {/* Kernels: pop in from off-screen and assemble into carton */}
        <div
          className="absolute inset-0 flex items-center justify-center text-amber-100"
          style={{
            filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.2))',
            top: '-14%',
            left: '-8%',
            right: '-8%',
            bottom: '-8%',
          }}
        >
          {FINAL.map((k, i) => {
            const start = getStartPos(i);
            return (
              <motion.span
                key={i}
                className="absolute"
                style={{
                  transform: `translate(-50%, -50%) rotate(${k.rotation}deg)`,
                }}
                initial={{
                  left: `${start.x}%`,
                  top: `${start.y}%`,
                  scale: 0,
                  opacity: 0,
                }}
                animate={{
                  left: `${k.x}%`,
                  top: `${k.y}%`,
                  scale: 1,
                  opacity: 0.92,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 75,
                  damping: 13,
                  delay: 0.25 + i * 0.02,
                }}
              >
                <KernelSvg size={k.size} />
              </motion.span>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
