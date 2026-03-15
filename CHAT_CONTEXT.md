# Chat context for future sessions

This file summarizes the project and what was done in this chat so a future AI or you can pick up context quickly.

**Habit:** When chat context usage reaches **~75%**, update this file with a short summary of the session so the next turn (or a new chat) can continue without losing context.

---

## What this project is

**Work-Life & Wellbeing Analyzer** — A Next.js app that:

- Lets users sign in with **Google (G Suite)** or **Microsoft (Outlook)**, or use **“See demo”** (demo mode with mock data).
- Syncs **email** and **calendar** (and for Google only: Meet, Docs) to build a work-life context.
- Shows an **8-bit-style** dashboard with a pixel character, ENERGY/LOAD bars, and a single natural-language **Summary** (e.g. “You’ve got a stressful schedule! Next up is …”) from schedule/context.
- **Character customizer:** Custom (head, torso, hair, skin, eyes, mouth, shirt) or **Preset** 8-bit icons (knight, moon, star, heart, sun, shield). Stored in localStorage; Terraria-style arrows (no text labels) for options.
- Supports **wellbeing check-ins** (energy 1–5, overwhelm 1–5, optional note) stored with a snapshot of current work context.
- **Phase 1 is analysis only** — no automated actions (no sending email, creating events, etc.).

---

## Tech stack

- **Next.js 14** (App Router), React, TypeScript, Tailwind.
- **Google:** `googleapis` (Gmail, Calendar, Drive, Docs), OAuth 2.0. Scopes: gmail.readonly, calendar.readonly, drive.readonly, documents.readonly, userinfo.
- **Microsoft:** Microsoft Graph (Outlook mail, Calendar). OAuth 2.0 via `login.microsoftonline.com`. Scopes: Mail.Read, Calendars.Read, User.Read, offline_access.
- **Storage:** JSON files in `data/` — `tokens.json` (provider + google/microsoft tokens), `context.json` (normalized events/messages/docs), `wellbeing.json` (check-ins).

---

## Project structure (important paths)

```
gsuite-wellbeing-analyzer/
├── .env.local              # Not committed; copy from .env.local.example
├── .env.local.example      # Template for Google + Microsoft env vars
├── CHAT_CONTEXT.md         # This file
├── README.md
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Home: two buttons (Microsoft, Google)
│   │   ├── dashboard/page.tsx          # Dashboard: ProfileOverview, WellbeingCheckIn, Dashboard
│   │   ├── layout.tsx                  # Press Start 2P font, pixel theme
│   │   ├── globals.css                 # CSS variables for 8-bit palette
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── google/route.ts     # GET → redirect to Google OAuth
│   │       │   ├── callback/route.ts   # Google callback, save tokens, redirect /dashboard
│   │       │   ├── microsoft/route.ts  # GET → redirect to Microsoft OAuth
│   │       │   ├── callback/microsoft/route.ts  # Microsoft callback
│   │       │   ├── session/route.ts    # GET → { authenticated, provider }
│   │       │   └── logout/route.ts     # POST → delete tokens
│   │       ├── sync/route.ts           # POST → sync from active provider (Google or Microsoft)
│   │       ├── context/route.ts         # GET → work-life context + provider
│   │       └── wellbeing/route.ts      # GET/POST check-ins
│   ├── components/
│   │   ├── Dashboard.tsx       # Calendar, Email, Meet, Docs; event colors by type; email list scroll, pin/star
│   │   ├── ProfileOverview.tsx # Character (xl), ENERGY/LOAD, Summary, character customizer (Custom/Preset)
│   │   ├── CharacterDisplay.tsx# Renders custom or preset pixel character (176px)
│   │   ├── PixelCharacter.tsx  # 8-bit character (mood by energy/overwhelm)
│   │   └── WellbeingCheckIn.tsx# Form: energy, overwhelm, note
│   ├── lib/
│   │   ├── store.ts            # Token store, context store, wellbeing
│   │   ├── profile-character.ts# Character profile (mode, iconId, hair, skin, etc.) in localStorage
│   │   ├── schedule-summary.ts # Natural-language summary from schedule/context
│   │   ├── demo-context.ts     # Mock context for demo mode
│   │   ├── google-auth.ts      # Google OAuth URL, token exchange, getValidAuthClient
│   │   ├── microsoft-auth.ts   # Microsoft auth URL, token exchange, refresh
│   │   ├── gmail.ts            # syncGmail(auth) → EmailMessage[] (HTML entity decode)
│   │   ├── calendar.ts         # syncCalendar(auth) → CalendarEvent[] (location); today+tomorrow, max 10
│   │   ├── docs.ts             # syncDocs(auth) → DocSummary[]
│   │   ├── outlook.ts          # syncOutlook(accessToken) → EmailMessage[]
│   │   ├── calendar-microsoft.ts # syncMicrosoftCalendar(accessToken) → CalendarEvent[]
│   │   └── analysis.ts         # buildWorkLifeContext(store, wellbeing, trend)
│   └── types/
│       └── context.ts          # CalendarEvent, EmailMessage, DocSummary, WellbeingCheckIn, WorkLifeContext
└── data/                      # Created at runtime (tokens.json, context.json, wellbeing.json)
```

---

## Auth and env

- **One provider at a time:** Last sign-in wins. Tokens stored as `{ provider: "google" | "microsoft", google?: {...}, microsoft?: {...} }`.
- **Google:** Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (default `http://localhost:3000/api/auth/callback`). Create OAuth client in GCP with that redirect.
- **Microsoft:** Set `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_REDIRECT_URI` (default `http://localhost:3000/api/auth/callback/microsoft`). App registration in Azure/Entra with redirect and API permissions: Mail.Read, Calendars.Read, User.Read, offline_access (Delegated). Supported account types: “Accounts in any organizational directory and personal Microsoft accounts” so school + personal can sign in.

**Microsoft + student/school accounts:** If the user gets 401 or “can’t create applications outside of a directory,” they should use a **personal Microsoft account** to create the app registration (e.g. via M365 Developer Program or Azure signup). The app can still accept **school account sign-in** on localhost as long as the app is registered with “Accounts in any org and personal.”

---

## Changes and fixes (session summary)

- **Login:** “See demo” link for demo mode (mock data); sign-in buttons same height, company colors (Microsoft blue, Google blue).
- **Theme:** More horizontal space (e.g. `max-w-[1600px]`), teal/slate palette; profile avatar as circular person icon with ring by state.
- **Emails:** HTML entities decoded (e.g. `&#39;` → `'`) in display and at sync; list scrollable (40 items), star for important, pin-to-top in localStorage; fixed-height row (~560px) so list scrolls.
- **Calendar:** Events as colored rectangles (meeting=red, gathering=green, 1:1=blue, etc.) with location; today + tomorrow, max 10; grid left-to-right then top-to-bottom; `location` on type and sync.
- **Profile/Summary:** STATUS + WHY replaced by single natural-language **Summary** from `src/lib/schedule-summary.ts`.
- **Character customizer:** Custom (head, torso, hair, skin, eyes, mouth, shirt) and Preset 8-bit icons (knight, moon, star, heart, sun, shield); profile in localStorage (`src/lib/profile-character.ts`); Terraria-style arrows only (no text labels); character preview xl (176px).
- **Deploy:** Pushed to **Abdul's-Branch** on https://github.com/join-relay/Relay; steps in `DEPLOY.md` (PowerShell-safe: use `;` not `&&`, quote branch name).
- **Earlier:** `microsoft-auth.ts` typo fix; dashboard overflow fixed with `min-w-0`, `overflow-hidden`, `break-words`, `break-all`.

---

## How to run and test

1. Copy `.env.local.example` to `.env.local` and fill in at least one provider (Google or Microsoft).
2. `npm install` then `npm run dev`. Open http://localhost:3000.
3. Click “Sign in with Microsoft (Outlook)” or “Sign in with Google (G Suite)” → complete OAuth → land on dashboard.
4. Click “Sync now” / “Refresh sync” to pull calendar and email (and for Google: Meet, Docs).
5. Use “Wellbeing check-in” to log energy/overwhelm/note; it appears in ProfileOverview and Latest wellbeing.

---

## Plan reference (original scope)

- Phase 1: Analysis only (no actions). G Suite: Gmail, Calendar, Meet, Docs + content-level (body, agenda, doc text/comments). Wellbeing: check-ins with context snapshot. Dashboard: work-life context + wellbeing, 8-bit theme, profile with character and “why” from data.
- Microsoft addition: Outlook + Calendar only (no Docs/Meet in Graph for this app). Same dashboard UI; provider-aware labels and sync path.

Use this file in a new chat by saying e.g. “Read CHAT_CONTEXT.md and help me with …” so the next session has full project and chat context.
