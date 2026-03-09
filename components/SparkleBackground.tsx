'use client';

import { motion } from 'framer-motion';

// Density matched across all pages (wizard + results)
const SPARKLE_COUNT = 55;
const SPARKLE_INTENSITY = 1;

// Fireplace-style low flicker: smooth opacity waves, varied timing so stars don't sync
function Sparkle({
  delay,
  x,
  y,
  size,
  duration,
  keyframes,
}: {
  delay: number;
  x: string;
  y: string;
  size: number;
  duration: number;
  keyframes: number[];
}) {
  return (
    <motion.span
      aria-hidden
      className="absolute pointer-events-none text-neon-gold"
      style={{ left: x, top: y, fontSize: size, textShadow: '0 0 8px rgba(255,215,0,0.6)' }}
      initial={{ opacity: keyframes[0] }}
      animate={{ opacity: keyframes }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        repeatType: 'reverse',
        ease: 'easeInOut',
      }}
    >
      ✦
    </motion.span>
  );
}

// Gentle flicker keyframes (low fireplace glow) — more points = smoother
const FLICKER_KEYFRAMES = [0.2, 0.45, 0.3, 0.55, 0.25, 0.5, 0.35, 0.45, 0.2].map(
  (t) => t * SPARKLE_INTENSITY
);

export default function SparkleBackground({ currentStep }: { currentStep?: number }) {
  const positions = Array.from({ length: SPARKLE_COUNT }, (_, i) => {
    // Vary duration 2.2–4s and phase so flickers don't align
    const duration = 2.2 + (i * 0.031) % 1.8;
    const delay = (i * 0.07) % 2.5;
    // Slight per-sparkle keyframe variation for organic feel
    const shift = (i % 5) * 0.02;
    const keyframes = FLICKER_KEYFRAMES.map((k) => Math.max(0.1, Math.min(0.7, k + shift)));
    return {
      id: i,
      x: `${3 + (i * 19) % 94}%`,
      y: `${5 + (i * 31) % 90}%`,
      size: 8 + (i % 6) * 3,
      delay,
      duration,
      keyframes,
    };
  });

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden>
      {positions.map((p) => (
        <Sparkle
          key={p.id}
          delay={p.delay}
          x={p.x}
          y={p.y}
          size={p.size}
          duration={p.duration}
          keyframes={p.keyframes}
        />
      ))}
    </div>
  );
}
