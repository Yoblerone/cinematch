# Push Cinematch to Your GitHub Repo

You created a repo on GitHub. Follow these steps to push your code into it.

---

## Do you have Git?

- **Yes** → Use Option A (command line) below.
- **Not sure / No** → Install [Git for Windows](https://git-scm.com/download/win) (use default options), then use Option A. Or use **Option B** (GitHub Desktop / upload).

---

## Option A: Command line (Terminal in Cursor or Git Bash)

**1. Open a terminal** in Cursor (Terminal → New Terminal) or open **Git Bash** in your project folder.

**2. Go to your project folder** (if you’re not already there):

```bash
cd "c:\Users\Yoni Shapiro\OneDrive\Desktop\Cursor Sandbox\Cinematch"
```

**3. Initialize Git** (only if this folder is not already a Git repo):

```bash
git init
```

**4. Add the GitHub repo as “origin”**

Use your repo (username: **Yoblerone**, repo: **cinematch**):

```bash
git remote add origin https://github.com/Yoblerone/cinematch.git
```

If you see “remote origin already exists”, use this instead to set the correct URL:

```bash
git remote set-url origin https://github.com/Yoblerone/cinematch.git
```

**5. Stage all files**

```bash
git add .
```

**6. Commit**

```bash
git commit -m "Initial commit: Cinematch"
```

**7. Rename branch to main (if needed) and push**

```bash
git branch -M main
git push -u origin main
```

When prompted for credentials:

- **Username:** your GitHub username  
- **Password:** use a **Personal Access Token**, not your GitHub password.  
  Create one: GitHub → Settings → Developer settings → Personal access tokens → Generate new token. Give it “repo” scope and paste it when asked for password.

After this, your code is on GitHub. Next step is [DEPLOY.md](./DEPLOY.md) to deploy on Vercel.

---

## Option B: GitHub Desktop or upload (no Git commands)

### Using GitHub Desktop

1. Install [GitHub Desktop](https://desktop.github.com/).
2. Sign in with your GitHub account.
3. **File → Add local repository** → choose the folder `Cinematch`.
4. If it says “this directory does not appear to be a Git repository”, click **create a repository** and create it in that folder.
5. Write a summary (e.g. “Initial commit”), click **Commit to main**.
6. Click **Publish repository** and choose your GitHub account and the repo you created (or let it create one). Then **Publish**.

### Using GitHub website (upload files)

1. On your repo page on GitHub, click **“uploading an existing file”** or **“Add file” → “Upload files”**.
2. Drag and drop the **contents** of your Cinematch folder (not the folder itself) — or select all files.  
   **Do not upload** the `node_modules` or `.next` folders (they’re in .gitignore; if you drag the whole folder, leave those out or skip them).
3. Add a commit message and click **Commit changes**.

This is less ideal for ongoing updates; Option A or GitHub Desktop is better for future pushes.

---

## Checklist

- [ ] Git installed (or using GitHub Desktop / upload)
- [ ] Repo URL is correct: `https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git`
- [ ] `git add .` and `git commit` done
- [ ] `git push -u origin main` succeeded (or published from GitHub Desktop / upload done)
- [ ] On GitHub you see your files (e.g. `app/`, `components/`, `package.json`)

Next: open [DEPLOY.md](./DEPLOY.md) and follow the Vercel steps to go live.
