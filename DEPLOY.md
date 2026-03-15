# Deploy / Publish

## Push to GitHub (branch: Abdul's Branch only)

Repo: **https://github.com/join-relay/Relay**  
Target branch: **Abdul's-Branch** (this is the only branch you push to)

Run these in the project folder (`gsuite-wellbeing-analyzer`):

```powershell
# 1. Go to project
cd "c:\Users\abdul\OneDrive\Desktop\gsuite-wellbeing-analyzer"

# 2. Initialize git (if not already)
git init

# 3. Add the GitHub repo as remote (skip if already added)
git remote add origin https://github.com/join-relay/Relay.git

# 4. Fetch and switch to Abdul's-Branch only
git fetch origin
git checkout -b "Abdul's-Branch" origin/"Abdul's-Branch"

# If you already have a local Abdul's-Branch, use:
#   git checkout "Abdul's-Branch"

# 5. Stage all files (respects .gitignore: no .env.local, node_modules, data/)
git add .

# 6. Commit
git commit -m "Add G Suite Wellbeing Analyzer app"

# 7. Push only to Abdul's-Branch
git push -u origin "Abdul's-Branch"
```

**If this is a fresh clone** (no existing branches yet):

```powershell
git fetch origin
git checkout "Abdul's-Branch"
git add .
git commit -m "Add G Suite Wellbeing Analyzer app"
git push -u origin "Abdul's-Branch"
```

**If you started from scratch** (no remote yet, branch doesn’t exist):

```powershell
git checkout -b "Abdul's-Branch"
git add .
git commit -m "Add G Suite Wellbeing Analyzer app"
git remote add origin https://github.com/join-relay/Relay.git
git push -u origin "Abdul's-Branch"
```

If you get "unrelated histories" when pushing:

```powershell
git pull origin "Abdul's-Branch" --allow-unrelated-histories
# fix any conflicts, then:
git push -u origin "Abdul's-Branch"
```

---

## Deploy the site (e.g. Vercel)

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. **Add New Project** → Import **join-relay/Relay**.
3. Set **Root Directory** to the folder that contains this app (if the repo has multiple projects, set it to the wellbeing app folder).
4. **Framework Preset**: Next.js (auto-detected).
5. **Environment variables** (Settings → Environment Variables): add the same as `.env.local`:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI` = `https://your-app.vercel.app/api/auth/callback`
   - (Optional) `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_REDIRECT_URI` = `https://your-app.vercel.app/api/auth/callback/microsoft`
6. Deploy. Then in **Google Cloud Console** and **Azure** add the production callback URLs to your OAuth clients.
