# Connecting Cinematch to TMDB (real data)

## 1. Get a TMDB API key

1. Create an account at [themoviedb.org](https://www.themoviedb.org).
2. Go to [Settings → API](https://www.themoviedb.org/settings/api).
3. Request an API key (choose “Developer”) and accept the terms.
4. **Application URL / Website:** If the form asks for a website domain and you don’t have one yet:
   - Enter **`N/A`** (TMDB accepts this for projects without a live URL), or
   - Use **`http://localhost:3000`** for a local app.
   - When you deploy (e.g. Vercel), you can add your real URL in TMDB API settings later.
5. Copy your **API Key (v3 auth)**.

## 2. Configure the key locally

- Copy `.env.example` to `.env.local`:  
  `cp .env.example .env.local`
- Open `.env.local` and set:  
  `TMDB_API_KEY=your_api_key_here`
- Restart the dev server (`npm run dev`) so the env var is picked up.

**Important:** Do not commit `.env.local` or your API key. It is already in `.gitignore` for Next.js.

## 3. What’s implemented (TMDB-only flow)

Cinematch uses **only TMDB** for results. There is no mock data in the main flow.

- **Find my match**  
  - Sends your full wizard filters to **`POST /api/tmdb/match`**.  
  - The server: runs TMDB Discover (genre, decade, runtime), enriches each movie (details, keywords, credits, director popularity), maps keywords to theme/visual/soundtrack, derives Energy sliders from genre + keywords, checks Oscar list and cast prominence, then runs the same filter/score logic as before and returns the sorted list.  
  - Results you see are 100% from TMDB and your wizard choices.

- **`lib/tmdb.ts`**  
  - Genre ↔ TMDB ID, decade/runtime ranges, Discover params.

- **`lib/tmdbEnrich.ts`**  
  - Fetches movie details, keywords, credits; maps keywords to Theme/Visual/Soundtrack; derives pacing, intensity, humor, romance, suspense, cryMeter from genre + keywords; director prominence from person popularity; Oscar from a curated list; hasAListCast from cast popularity; cult classic / critics vs fans from vote and revenue.

- **`lib/oscarWinners.ts`**  
  - TMDB IDs for Best Picture winners (extend the set as needed).

- **`GET /api/tmdb/discover`**  
  - Still available for simple discover (genre, decade, runtime, page) if you need it elsewhere.

## 4. What TMDB doesn’t provide (and how we handle it)

- **Sliders** (pacing, intensity, cryMeter, humor, romance, suspense): TMDB has no direct fields. We **derive** them from genre + movie keywords (e.g. Comedy → higher humor, Romance → higher romance, Thriller → higher suspense) so filtering and scoring use real-data–driven values.
- **Theme / Visual / Soundtrack**: We fetch **keywords** per movie and map keyword names to your Theme / Visual Style / Soundtrack tags so those filters apply to real TMDB data.
- **Oscar winner**: TMDB doesn’t list Oscars. We use a **curated list** of TMDB movie IDs for Best Picture winners (`lib/oscarWinners.ts`); you can extend it.
- **Director prominence**: From TMDB **credits** (director) + **person** popularity, scaled to 0–100.
- **A-List cast**: Inferred from top cast **popularity** in credits.

## 5. Optional next steps

- **Expand Oscar list** – Add more TMDB IDs to `lib/oscarWinners.ts` (e.g. from [TMDB’s Best Picture list](https://www.themoviedb.org/list/3728-oscar-best-picture-winners)).
- **Keyword mapping** – Refine `keywordToThemes` / `keywordToVisualStyles` / `keywordToSoundtracks` in `lib/tmdbEnrich.ts` if you want more theme/visual/soundtrack tags from TMDB keywords.
- **Slider derivation** – Tweak `deriveSliders()` in `lib/tmdbEnrich.ts` (genre + keyword weights) to better match how you want Energy filters to behave.
- **Caching** – Enriched movie data could be cached (e.g. by TMDB ID) across requests to reduce API calls and speed up repeat searches.
