'use client';

/**
 * Theater marquee-style logo: GoodReels with lowercase "oo" and "ee",
 * metal gradient, bulb glow, double brass frame.
 */
export default function MarqueeLogo() {
  return (
    <div className="inline-flex items-center justify-center rounded-md border-[3px] border-double border-[#FFD700]/90 px-3 py-1.5 sm:px-4 sm:py-2 bg-cherry-950/80">
      <span className="marquee-logo font-display font-bold tracking-[0.04em] text-2xl sm:text-3xl md:text-4xl leading-none inline-flex items-baseline whitespace-nowrap">
        <span>G</span>
        <span className="lowercase">oo</span>
        <span>d</span>
        <span>R</span>
        <span className="lowercase">ee</span>
        <span>ls</span>
      </span>
    </div>
  );
}
