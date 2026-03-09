# Deploy Cinematch to Vercel (GitHub + Vercel)

Follow these steps to get Cinematch live. You only need **GitHub** and **Vercel**; the app uses **TMDB** for data (no Supabase yet—you can add it later for auth or saved lists).

**If you created a GitHub repo but haven’t pushed your code yet,** see **[PUSH_TO_GITHUB.md](./PUSH_TO_GITHUB.md)** first, then come back here for Vercel.

---

## 1. Push your code to GitHub

If the project is **not** in a Git repo yet:

```bash
cd "c:\Users\Yoni Shapiro\OneDrive\Desktop\Cursor Sandbox\Cinematch"
git init
git add .
git commit -m "Initial commit: Cinematch"
```

Create a **new repository** on GitHub (e.g. `cinematch`). Do **not** add a README or .gitignore there (you already have them). Then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/cinematch.git
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username. If you use SSH: `git@github.com:YOUR_USERNAME/cinematch.git`.

If the project **is** already a Git repo and you already have a GitHub remote:

```bash
git add .
git commit -m "Prepare for deployment"   # if you have changes
git push origin main
```

---

## 2. Deploy on Vercel

1. Go to **[vercel.com](https://vercel.com)** and sign in (use **Continue with GitHub**).
2. Click **Add New…** → **Project**.
3. **Import** your `cinematch` repository (or the one you pushed). Vercel will detect Next.js.
4. Before clicking **Deploy**, open **Environment Variables** and add:
   - **Name:** `TMDB_API_KEY`  
   - **Value:** your TMDB API key (same as in `.env.local`).  
   Get one at [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) if needed.
5. Click **Deploy**. Vercel will build and host the app.

When it finishes, you’ll get a URL like `cinematch-xxx.vercel.app`. Every push to `main` will trigger a new deployment.

---

## 3. (Optional) Custom domain

In the Vercel project: **Settings** → **Domains** → add your domain and follow the DNS instructions.

---

## 4. Supabase (optional, for later)

The app does **not** use Supabase yet. When you’re ready you can use it for:

- **Auth** — sign in / sign up
- **Database** — e.g. saved matches or watchlist

You’d add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (and optionally `SUPABASE_SERVICE_ROLE_KEY`) in Vercel **Environment Variables** and in `.env.local` for local dev.

---

## Checklist

- [ ] Code pushed to GitHub
- [ ] Vercel project created and repo imported
- [ ] `TMDB_API_KEY` set in Vercel Environment Variables
- [ ] Deploy succeeded; live URL works (try “Find My Match” with any filters)
