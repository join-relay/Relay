# Relay — Project State (Handoff Document)

Use this document to continue work in another chat. It summarizes the codebase, architecture, what’s built, and what’s planned.

---

## 1. Product & Repo

- **Relay**: A disclosed AI chief-of-staff / “stunt double” for overload moments.
- **Repo**: Next.js 14 app, TypeScript, Google-first (no Microsoft Teams).
- **Tagline**: “Your overload operating system”; bot identity: **Yassin's Relay** (from `lib/constants.ts`).

---

## 2. Agent Rules (AGENTS.md)

**Always follow these when editing:**

- **Source of truth**: Google-first revised plan (see plan file and sections below).
- **Out of scope**: Microsoft Teams.
- **Auth**: Google OAuth is required for Gmail, Calendar, Drive, Meet-related data.
- **Honesty**: Never imply Relay joined or spoke in a meeting without real proof.
- **UI**: Preserve the existing Briefing and Actions UI.
- **Meeting route**: Keep `/meeting`, but use it for Google Meet readiness and honest fallback states only.
- **Scope**: Build only the approved next pass unless explicitly asked otherwise.

---

## 3. Tech Stack

| Layer        | Tech |
|-------------|------|
| Framework   | Next.js 14.2.18 (App Router) |
| Language    | TypeScript 5 |
| Auth        | NextAuth v5 (beta), Google provider |
| Data        | Google APIs (Gmail, Calendar, Drive), file-based persistence (`.relay/*.json`) |
| DB          | Not wired yet; `project.sql` is reference schema only; `lib/db/client.ts` throws if used |
| UI          | React 18, Tailwind CSS, Radix (slot), TanStack Query, Lucide icons, CVA, clsx, tailwind-merge |
| Google SDK  | `googleapis` (Gmail, Calendar, Drive) |

---

## 4. Architecture (Google-First Plan)

Planned flow (from `.cursor/plans/relay_google_first_replan_f5b2c3d3.plan.md`):

- **Dashboard** → `api/briefing`, `api/actions`, `api/meeting/*`, Settings, History.
- **Auth**: Auth.js Google OAuth → encrypted Google tokens (file store).
- **Briefing**: Gmail + Calendar services (+ optional OpenAI reasoning later).
- **Actions**: Gmail send, Calendar patch, audit persistence.
- **Meeting**: Google Meet discovery from Calendar; Meet REST (and optional Meet Media) later; no fake “joined/spoke”.
- **Persistence**: File-based now (`.relay/`); Postgres when Phase 5+.

**Phases (summary):**

- **G0**: Scope reset, remove Teams, repurpose Meeting for Google Meet readiness.
- **G1**: Google Auth, live Gmail/Calendar read, Briefing wired to live with mock fallback. ✅ Largely done.
- **G2**: Real action execution (Gmail send, Calendar patch), Drive Picker selected files, persistence, History. ✅ Partially done (actions + history; Drive API exists, Picker UI may be minimal).
- **G3**: OpenAI reasoning + speech (briefing, actions, meeting summaries).
- **G4**: Meet REST–first meeting phase (detect Meet from Calendar, status, artifacts, honest fallback).
- **G5**: Optional Meet Media preview (real-time audio if env qualifies).

**Next recommended pass**: G0 + G1 together (already mostly implemented). Then G2 completion, then G3/G4.

---

## 5. Repository Structure

```
Relay/
├── AGENTS.md                 # Rules for AI (Google-first, no Teams, honest Meeting)
├── PROJECT_STATE.md          # This file
├── README.md                 # One-liner product description
├── .env.example              # Env var template
├── .env.local                # Local env (not committed)
├── auth.ts                   # NextAuth config, Google provider, getOptionalSession, signIn/signOut
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.ts        # Relay brand colors, radii, shadows
├── tsconfig.json             # paths: "@/*" -> ./*
├── project.sql               # Reference schema (commented); not applied to a DB yet
├── .cursor/plans/            # relay_google_first_replan_*.plan.md is source of truth
├── .relay/                   # File-based persistence (created at runtime)
│   ├── google-connections.json
│   ├── action-executions.json
│   └── selected-drive-files.json
├── app/
│   ├── layout.tsx            # Root: Inter font, QueryProvider, globals.css
│   ├── globals.css            # CSS variables, Relay palette, relay-fade-in animation
│   ├── (dashboard)/
│   │   ├── layout.tsx        # Sidebar + Header + main content area
│   │   ├── page.tsx           # Redirects to /briefing
│   │   ├── briefing/page.tsx  # Briefing: getBriefing(), BriefingCard, InboxSummary, CalendarSummary, PriorityList
│   │   ├── actions/page.tsx   # Client: fetch /api/actions, approve/reject/edit mutations, ActionCard list
│   │   ├── meeting/page.tsx   # Client: meeting readiness, upcoming Meet, join link check (no real join)
│   │   ├── history/page.tsx   # Server: listActionExecutions(), execution list
│   │   └── settings/page.tsx  # Server: Google status, connect/disconnect Google
│   └── api/
│       ├── auth/[...nextauth]/route.ts   # GET/POST -> handlers from auth
│       ├── briefing/route.ts            # GET -> getBriefing()
│       ├── actions/route.ts              # GET -> listActions(), substituteDisplayName
│       ├── actions/[id]/route.ts         # PATCH -> updateActionContent
│       ├── actions/[id]/approve/route.ts # POST -> approveAction
│       ├── actions/[id]/reject/route.ts  # POST -> rejectAction
│       ├── integrations/google/status/route.ts  # GET -> Google integration status
│       ├── meeting/status/route.ts       # GET -> getMeetingReadinessStatus()
│       ├── meeting/upcoming/route.ts     # GET -> getUpcomingMeetingStatus()
│       ├── meeting/join/route.ts         # POST -> prepareMeetingLinkCheck (validates Meet link only)
│       └── drive/selected/route.ts       # GET/POST -> get/set selected Drive files per user
├── components/
│   ├── briefing/             # BriefingCard, InboxSummary, CalendarSummary, PriorityList
│   ├── actions/              # ActionsPageHeader, ActionCard, DraftReview, ApprovalControls
│   ├── meeting/               # MeetingPageHeader, IntegrationCheckpointCard, JoinValidationPanel
│   ├── layout/                # Sidebar, SidebarBranding, Header, DemoModeIndicator
│   └── providers/            # QueryProvider (TanStack Query)
├── lib/
│   ├── constants.ts          # APP_NAME, BOT_LABEL, DEMO_MODE_LABEL, PRODUCT_LINE
│   ├── utils.ts              # cn() etc.
│   ├── db/client.ts          # isDatabaseConfigured(); getDatabaseClient() throws (DB not wired)
│   ├── security/encryption.ts # AES-256-GCM for refresh tokens; ENCRYPTION_KEY
│   ├── services/
│   │   ├── google-auth.ts    # OAuth token store, refresh, getGoogleAccessToken, getBaseGoogleIntegrationStatus
│   │   ├── gmail.ts          # getLiveGmailThreads, sendEmail (Gmail API)
│   │   ├── calendar.ts       # getLiveCalendarEvents, getConflictingEvents, getUpcomingGoogleMeet, patchCalendarEvent
│   │   ├── drive.ts          # getDriveFileMetadata (Drive API)
│   │   ├── briefing.ts      # getBriefing(): live Gmail+Calendar or mock
│   │   ├── actions.ts       # listActions, approveAction, rejectAction, updateActionContent; live or mock
│   │   └── meeting-readiness.ts  # getMeetingReadinessStatus, getUpcomingMeetingStatus, prepareMeetingLinkCheck
│   ├── persistence/
│   │   ├── action-executions.ts  # appendActionExecution, listActionExecutions (file store)
│   │   └── selected-drive-files.ts # get/set selected Drive files by user email (file store)
│   ├── mocks/                # briefing.ts, actions.ts, gmail.ts, calendar.ts, meeting.ts
│   └── demo/                 # seed.ts, scenarios.ts (demo data; Calendar/Gmail use "Google Meet" in copy)
├── types/
│   └── index.ts              # GmailThread, CalendarEvent, Briefing, PendingAction, ActionExecutionRecord, Meeting types, GoogleIntegrationStatus
└── public/                   # relay-logo.png, relay-logo-horizontal*.png
```

---

## 6. What’s Implemented

### 6.1 Auth & Google

- **auth.ts**: NextAuth with Google provider; `access_type: "offline"`, `prompt: "consent"`; JWT strategy; in JWT callback, `upsertGoogleAccountTokens` stores/refreshes tokens.
- **lib/services/google-auth.ts**:
  - Token store: in-memory Map + `.relay/google-connections.json`.
  - Scopes: openid, email, profile, gmail.readonly, gmail.send, calendar.readonly, calendar.events, drive.file.
  - `getGoogleAccessToken(email)` with refresh; `getBaseGoogleIntegrationStatus()` for UI; `clearGoogleAccountConnection`, `getGoogleAccountRecord`, `upsertGoogleAccountTokens`.
- **lib/security/encryption.ts**: Encrypt/decrypt refresh token with ENCRYPTION_KEY (hex 64-char or base64 32-byte or any string hashed with SHA-256).

### 6.2 Briefing

- **GET /api/briefing** → `getBriefing()`.
- **lib/services/briefing.ts**:
  - If session + Google validated: live Gmail threads + Calendar events; builds priorities from unread email, conflicts, upcoming Google Meet.
  - Else: mock briefing + `source: "mock"` and `statusNote`.
- **Briefing page**: Server component; shows status note, BriefingCard, InboxSummary, CalendarSummary, PriorityList.

### 6.3 Actions

- **GET /api/actions** → listActions (session displayName substituted in bodies).
- **PATCH /api/actions/[id]** → updateActionContent (draft/reschedule payload).
- **POST /api/actions/[id]/approve** → approveAction (optional body.content); on success executes Gmail send or Calendar patch when live, and appends to action-executions.
- **POST /api/actions/[id]/reject** → rejectAction.
- **lib/services/actions.ts**:
  - With live Google: derives draft_email from Gmail threads and reschedule_meeting from calendar conflicts; merges with in-memory store; approve runs real `sendEmail` or `patchCalendarEvent` and `appendActionExecution`.
  - Without: mock actions from `lib/mocks/actions.ts` (seededActions).
- **Persistence**: Approved/rejected state in memory; execution records in `.relay/action-executions.json` via `lib/persistence/action-executions.ts`.

### 6.4 Meeting (Readiness Only)

- **GET /api/meeting/status** → getMeetingReadinessStatus (checkpoints: googleAuth, gmailBriefing, calendarRead, meetDiscovery, liveJoinPath; last is always “fallback” — no real join).
- **GET /api/meeting/upcoming** → getUpcomingMeetingStatus (next Google Meet from Calendar or fallback).
- **POST /api/meeting/join** → body.targetMeeting; validates Google Meet link format only; returns state “fallback” with message that Relay doesn’t join yet.
- **Meeting page**: Shows readiness checkpoints, assumptions, manual steps, upcoming Meet from Calendar, runtime evidence; JoinValidationPanel for link check only.

### 6.5 Settings & History

- **Settings**: Google connection status (account, scopes, Gmail/Calendar ready, next Meet); Connect / Disconnect (server actions: signIn, clear + signOut).
- **History**: Lists action executions from `.relay/action-executions.json` (success/failed, source live|mock, errorMessage if failed).

### 6.6 Drive

- **lib/services/drive.ts**: getDriveFileMetadata (Drive API) for a file ID.
- **lib/persistence/selected-drive-files.ts**: get/set selected files by user email (file store).
- **GET/POST /api/drive/selected**: Read/update selected Drive files for the signed-in user.

### 6.7 Gmail & Calendar

- **lib/services/gmail.ts**: getLiveGmailThreads (INBOX, primary, 7d), sendEmail (including threadId for reply).
- **lib/services/calendar.ts**: getLiveCalendarEvents (today, multi-calendar), getConflictingEvents, getUpcomingGoogleMeet, isGoogleMeetEvent, patchCalendarEvent (composite id `calendarId:eventId`).

---

## 7. Types (types/index.ts)

- **Briefing**: displayName, date, source?, statusNote?, inboxSummary, calendarSummary, priorities.
- **GmailThread**, **CalendarEvent** (with provider, meetingProvider, joinUrl, isConflict, etc.).
- **PriorityItem**, **PendingAction** (DraftEmailPayload, RescheduleMeetingPayload), **ActionsViewState**.
- **ActionExecutionRecord**: id, actionId, type, title, proposedPayload, executedAt, status, errorMessage?, userEmail?, source (live|mock).
- **IntegrationState**: not_configured | blocked | fallback | validated.
- **MeetingIntegrationCheckpoint**, **MeetingLinkCheckAttempt**, **MeetingUpcomingStatus**, **MeetingReadinessStatus**.
- **GoogleIntegrationStatus**: status, displayName, email, scopes, missingEnv, hasSession, hasRefreshToken, encryptionReady, canReadGmail, canReadCalendar, canUseLiveBriefing, nextMeetEvent?, note.

---

## 8. Environment Variables

From `.env.example` (and plan):

- **Auth**: NEXTAUTH_SECRET, NEXTAUTH_URL (e.g. http://localhost:3000), GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET.
- **Security**: ENCRYPTION_KEY (required for storing refresh token).
- **Database**: DATABASE_URL (Phase 5+; not used yet).
- **AI**: OPENAI_API_KEY (later phase).

No middleware file present; auth is used per-route (e.g. getOptionalSession).

---

## 9. UI / Theming

- **globals.css**: Relay palette (e.g. --relay-bg #DFE8F1, --relay-primary-dark #1B2E3B), semantic tokens (background, foreground, primary, border, etc.), `.animate-relay-fade-in`, `.transition-smooth`.
- **tailwind.config.ts**: relay colors, rounded-relay-card/inner/control, shadow-relay-soft/elevated.
- **Layout**: Dashboard has fixed Sidebar (Briefing, Actions, Meeting, History, Settings), Header, main content on `#DFE8F1` background.

---

## 10. Not Done / Planned

- **Database**: No Postgres; only file-based stores and `project.sql` as reference.
- **Middleware**: Not added; plan mentioned it for protected routes if needed.
- **OpenAI**: No reasoning or speech services yet (G3).
- **Meet REST/Media**: No Meet REST or Meet Media integration yet (G4/G5); Meeting page is readiness + honest fallback only.
- **Drive Picker**: Drive API and selected-files persistence exist; Google Picker UI in Settings (or elsewhere) may be minimal or missing.
- **Incremental OAuth**: Currently requests a fixed set of scopes at sign-in; plan suggests incremental scope upgrades when user enables features.

---

## 11. How to Continue in Another Chat

1. **Paste or attach** this file (and optionally `AGENTS.md` and `.cursor/plans/relay_google_first_replan_f5b2c3d3.plan.md`) so the agent knows the product and rules.
2. **State the goal** e.g. “Implement G2 Drive Picker in Settings” or “Add OpenAI briefing synthesis (G3)” or “Wire Meet REST for post-meeting artifacts (G4).”
3. **Remind** the agent: Google-only, no Teams, never claim Relay joined/spoke without proof, preserve Briefing and Actions UI.
4. **Env**: Ensure .env.local has NEXTAUTH_*, GOOGLE_*, ENCRYPTION_KEY for local Google auth and live Briefing/Actions.

---

## 12. Quick Reference: Key Files

| Purpose              | File(s) |
|----------------------|--------|
| Auth config          | auth.ts, app/api/auth/[...nextauth]/route.ts |
| Google tokens        | lib/services/google-auth.ts, lib/security/encryption.ts |
| Briefing logic       | lib/services/briefing.ts, app/api/briefing/route.ts |
| Actions logic        | lib/services/actions.ts, app/api/actions/*.ts |
| Meeting readiness    | lib/services/meeting-readiness.ts, app/api/meeting/*.ts |
| Gmail / Calendar     | lib/services/gmail.ts, lib/services/calendar.ts |
| Persistence          | lib/persistence/action-executions.ts, selected-drive-files.ts |
| Types                | types/index.ts |
| Agent rules          | AGENTS.md |
| Full plan            | .cursor/plans/relay_google_first_replan_f5b2c3d3.plan.md |
