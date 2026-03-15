# G Suite Work-Life & Wellbeing Analyzer (Phase 1)

Analyzes your Gmail, Google Calendar, Google Meet, and Google Docs to build a unified view of your work life, plus conversation-based wellbeing check-ins. Analysis only; no automated actions.

## GCP setup (Google Cloud project, OAuth, credentials)

1. **Create a project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/).
   - Create a new project or select an existing one.

2. **Enable APIs**
   - APIs & Services → Library.
   - Enable: **Gmail API**, **Google Calendar API**, **Google Drive API**, **Google Docs API**.

3. **OAuth consent screen**
   - APIs & Services → OAuth consent screen.
   - Choose **External** (or Internal for workspace-only).
   - Fill App name, User support email, Developer contact.
   - Scopes: Add `.../auth/gmail.readonly`, `.../auth/calendar.readonly`, `.../auth/drive.readonly`, `.../auth/documents.readonly`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`.
   - Add test users if in Testing mode.

4. **Credentials**
   - APIs & Services → Credentials → Create credentials → **OAuth client ID**.
   - Application type: **Web application**.
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback` (and your production URL if needed).
   - Copy **Client ID** and **Client secret**.

5. **Env file**
   - Copy `.env.local.example` to `.env.local`.
   - Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and optionally `GOOGLE_REDIRECT_URI`.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with Google, then use **Sync from G Suite** on the dashboard. Data is stored under `data/` (tokens, context, wellbeing).

## Tech

- Next.js 14 (App Router), React, TypeScript, Tailwind.
- Google APIs: `googleapis` (Gmail, Calendar, Drive, Docs) with OAuth 2.0.
- Storage: JSON files in `data/` (tokens, normalized context, wellbeing check-ins).
