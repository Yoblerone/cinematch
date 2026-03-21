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
- **`lib/filterMovies.ts`** — Filtering + ranking only (no max-slider keyword hard-delete): genre base, main-plot conflict map, `VIBE_EXTREME_MAP` metadata penalties/bonuses, critics/fans weighting.
- **`lib/smartHarvest.ts`** / **`lib/tmdbVibeKeywordBridge.ts`** (phrase → ID for audits) / **`lib/genreConflictMap.ts`** — Discover uses **genres + `without_genres` + runtime/decade** only — **no `with_keywords`** for Energy/theme/visual/soundtrack (keywords rank in-app via `vibeScore`). Sliders **81–99** use optional genre OR; any axis at **100** adds a **primary** genre into `with_genres` and **`GENRE_CONFLICT_MAP`** union-excludes “opposite” genres (e.g. Romance **100** → no War **10752** / Horror **27**; Humor **100** → no War **10752** / Horror **27**; Cry **100** → no Action **28** / Adventure **12**; Suspense **100** → no Comedy **35** / Family **10751**). **User Wins:** selected UI genres are never excluded from `without_genres` (e.g. Drama + Humor 100 keeps Drama in pool). With user genres, anchors are **AND**-merged; with none, slider genres use **OR**. Discover targets **~100** rows (pages 1–5), **`sort_by=popularity.desc`**, softer **`vote_count.gte`** when Smart Harvest is active. **Second harvest** if the first pass is thin and the user had genre picks. **Academy** paths skip Smart Harvest on Discover.
- **Results grid** — 3×3 (9 per page) pagination works with any pool size (prefer fewer strong matches over padding with weak ones).

## Tech stack

- Next.js 14 (App Router)
- Tailwind CSS (custom theme: burgundy, brass, neon)
- Framer Motion
- Lucide React
- TypeScript
