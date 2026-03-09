'use client';

/**
 * Theater marquee-style logo: serif type, bulb glow (layered gold shadow),
 * metal gradient, subtle flicker, double brass frame.
 */
export default function MarqueeLogo({ text = 'CINEMATCH' }: { text?: string }) {
  return (
    <div className="inline-block rounded-lg border-4 border-double border-brass/90 px-6 py-3 sm:px-8 sm:py-4 bg-cherry-950/80">
      <span className="marquee-logo-text font-display font-bold uppercase tracking-[0.12em] text-2xl sm:text-3xl md:text-4xl">
        {text}
      </span>
    </div>
  );
}
