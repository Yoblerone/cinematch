# Cinematch

A premium movie discovery engine with a **Modern Neo-Deco** aesthetic (velvet, brass, and neon). Built with Next.js, Tailwind CSS, Framer Motion, and Lucide React.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy live (Vercel + GitHub)

See **[DEPLOY.md](./DEPLOY.md)** for step-by-step instructions: push to GitHub, connect the repo to Vercel, add `TMDB_API_KEY`, and go live. Supabase is optional for later (auth, saved lists).

## Features

- **Red Carpet Wizard** — 4-step flow:
  1. **The Crowd** — Solo, Date Night, or Group
  2. **The Energy & Emotion** — Sliders for Pacing, Intensity, and Cry Meter
  3. **The Aesthetic** — Visual Style (Noir, Technicolor, Gritty, Symmetric) and Soundtrack (Synth, Orchestral, Minimalist)
  4. **The Pedigree** — Cult Classic, A-List Cast, Critics vs. Fans

- **Fade to Black** — Smooth step transitions
- **Results grid** — Movie cards with brass borders and a “projector light” shimmer on hover
- **Director’s Console** — Floating “Director’s Slate” button that opens a top-drawer modal to tweak all filters without restarting the wizard

## Data & filtering

- **`lib/mockData.ts`** — 20 movies with attributes aligned to every filter (crowd, pacing, intensity, cryMeter, visualStyle, soundtrack, isCultClassic, hasAListCast, criticsVsFans).
- **`lib/filterMovies.ts`** — Filtering + ranking: genre base, then Energy slider keyword nukes/bonuses (`VIBE_EXTREME_MAP` in `lib/vibeScore.ts`), then critics/fans weight (TMDB keywords merged from `append_to_response` + `/movie/{id}/keywords`).

## Tech stack

- Next.js 14 (App Router)
- Tailwind CSS (custom theme: burgundy, brass, neon)
- Framer Motion
- Lucide React
- TypeScript
