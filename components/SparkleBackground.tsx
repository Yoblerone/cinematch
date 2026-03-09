'use client';

import { motion } from 'framer-motion';

// Sparkle count and intensity scale with step (1 = subtle, 5 = very sparkly)
const SPARKLE_COUNTS = [10, 18, 28, 40, 55];

function Sparkle({ delay, x, y, size, intensity }: { delay: number; x: string; y: string; size: number; intensity: number }) {
  const baseOpacity = 0.25 + intensity * 0.4;
  return (
    <motion.span
      aria-hidden
      className="absolute pointer-events-none text-neon-gold"
      style={{ left: x, top: y, fontSize: size, textShadow: '0 0 8px rgba(255,215,0,0.6)' }}
      initial={{ opacity: 0 }}
      animate={{
        opacity: [0, baseOpacity * 0.5, baseOpacity, baseOpacity * 0.6, baseOpacity],
      }}
      transition={{
        duration: 2.5,
        delay,
        repeat: Infinity,
        repeatDelay: 1.5,
      }}
    >
      ✦
    </motion.span>
  );
}

export default function SparkleBackground({ currentStep }: { currentStep: number }) {
  const count = SPARKLE_COUNTS[Math.min(currentStep - 1, SPARKLE_COUNTS.length - 1)] ?? SPARKLE_COUNTS[0];
  const intensity = currentStep / 5;
  const positions = Array.from({ length: count }, (_, i) => ({
    id: i,
    x: `${3 + (i * 19) % 94}%`,
    y: `${5 + (i * 31) % 90}%`,
    size: 8 + (i % 6) * 3,
    delay: (i * 0.03) % 2,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden>
      {positions.map((p) => (
        <Sparkle
          key={p.id}
          delay={p.delay}
          x={p.x}
          y={p.y}
          size={p.size}
          intensity={intensity}
        />
      ))}
    </div>
  );
}
