# Relay

Relay is a Google-first AI chief-of-staff for people who run overloaded calendars and inboxes. It turns Gmail + Calendar context into a daily briefing, suggests high-leverage actions, drafts replies in your style, and keeps meeting readiness honest about what is proven versus what is still fallback.

## One-Line Pitch

Relay helps you decide what matters next, then execute safely with human approval and explicit runtime evidence.

## Why We Built It

Most productivity tools either dump information on you or overpromise autonomous behavior. We wanted a system that is:

- proactive (surface priorities before you ask),
- useful (turn priorities into actionable drafts),
- accountable (show data source, fallback state, and execution history),
- honest (never claim meeting attendance or speaking without proof).

## What Relay Does Today

### 1) Briefing (Live Google or Explicit Fallback)

- Reads Gmail threads and Calendar events when Google auth is configured.
- Builds an inbox + calendar summary with priority candidates.
- Uses deterministic heuristics first, with optional OpenAI reasoning enhancement.
- Falls back to mock data with clear status notes when live reads are unavailable.

### 2) Actions (Human-in-the-Loop)

- Converts live or mock signals into pending actions.
- Supports approve, reject, and edit before execution.
- Generates email drafts using personalization + optional reasoning models.
- Records action execution history for trust and auditability.

### 3) Meeting Readiness (Google-First, Evidence-First)

- Detects upcoming Google Meet links from Calendar when available.
- Shows integration checkpoints and explicit readiness states.
- Includes Recall.ai provider scaffolding and webhook ingestion for transcript events.
- Does not claim Relay joined or spoke in a meeting without real provider evidence.

### 4) Personalization + Settings

- Stores communication preferences (tone, formality, conciseness, etc.).
- Applies style settings to generated drafts and future meeting update posture.
- Displays Google connection status, granted scopes, and missing env blockers.

## Current Scope and Guardrails

- Google-first is the source of truth for Gmail, Calendar, Drive, and Meet-related readiness.
- Microsoft Teams is out of scope in this implementation pass.
- Meeting route is intentionally focused on readiness and explicit fallback states.
- Live meeting join/speak/summarize claims require real runtime evidence.

## Tech Stack

- Frontend: Next.js 14 (App Router), React 18, Tailwind CSS
- Auth: Auth.js (NextAuth) with Google OAuth
- Data + integration: Google APIs (Gmail, Calendar, Drive)
- AI reasoning: OpenAI Responses API (configurable models)
- Meeting provider scaffolding: Recall.ai API + signed webhooks
- Testing: Vitest (unit), Playwright (e2e)
- Language: TypeScript

## Architecture Snapshot

- UI routes: dashboard pages for Briefing, Actions, Meeting, History, Settings
- API routes: typed route handlers under app/api for briefing/actions/meeting/auth/webhooks
- Service layer: integration and orchestration logic in lib/services
- Persistence: lightweight local stores in lib/persistence (with reference SQL schema for future DB migration)
- Safety model: explicit source labeling (live vs mock), fallback notes, and execution logs

## Repository Highlights

- app/(dashboard): product UI surfaces
- app/api/actions: action listing, editing, approval/rejection, draft generation
- app/api/briefing: briefing payload endpoint
- app/api/meeting: readiness, upcoming, join validation, provider bot creation
- app/api/webhooks/recall: signed Recall webhook processing
- lib/services/briefing.ts: briefing orchestration
- lib/services/actions.ts: action generation + execution orchestration
- lib/services/meeting-readiness.ts: readiness state model and guardrails
- lib/services/google-auth.ts: Google OAuth token storage/refresh and scope checks
- lib/services/recall.ts: Recall provider readiness and bot creation scaffolding

## Local Setup

### Prerequisites

- Node.js 18+
- npm

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment variables

```bash
cp .env.example .env.local
```

Set required values in .env.local:

- NEXTAUTH_SECRET
- NEXTAUTH_URL (example: http://localhost:3000)
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- ENCRYPTION_KEY

Optional but recommended:

- OPENAI_API_KEY
- OPENAI_REASONING_MODEL (default: gpt-4o-mini)
- OPENAI_HEAVY_REASONING_MODEL (default: gpt-4o-mini)
- RECALL_API_KEY
- RECALL_WEBHOOK_SECRET
- RECALL_API_BASE_URL
- RELAY_PUBLIC_URL (recommended for webhook URL construction)
- RELAY_DEV_AUTH_BYPASS=1 (dev-only test auth mode)
- ANTHROPIC_API_KEY (only for isolated meeting-agent prototype scripts/docs)

### 3) Run the app

```bash
npm run dev
```

Open http://localhost:3000

## Scripts

- npm run dev: start local dev server
- npm run build: production build
- npm run start: run production build
- npm run lint: lint checks
- npm run typecheck: TypeScript checks
- npm run test: Vitest in watch mode
- npm run test:run: Vitest single run
- npm run test:e2e: Playwright tests
- npm run test:agent: isolated live agent script (Anthropic-powered prototype)

## API Surface (Selected)

- GET /api/briefing
- GET /api/actions
- PATCH /api/actions/:id
- POST /api/actions/:id/approve
- POST /api/actions/:id/reject
- POST /api/actions/:id/draft
- GET /api/meeting/status
- GET /api/meeting/upcoming
- POST /api/meeting/join
- POST /api/meeting/providers/recall/bot
- POST /api/webhooks/recall

## Demo + Fallback Philosophy

Relay is intentionally explicit about runtime state:

- live state: real Google data and/or provider-confirmed evidence,
- fallback state: deterministic mock path with explanation,
- blocked/not_configured state: missing auth/env/scope dependencies.

This makes demos trustworthy and prevents hidden behavior or false claims.

## Devpost-Ready Summary

If you want to paste this project into Devpost quickly, use the sections below.

### Inspiration

People with overloaded inboxes and calendars lose energy deciding what to do next. We built Relay to reduce that cognitive overhead without pretending full autonomy where evidence does not exist.

### What it does

Relay creates a smart daily briefing from Gmail and Calendar, suggests and drafts high-impact actions, and provides a meeting readiness view for Google Meet with explicit integration checkpoints and fallback states.

### How we built it

We built Relay with Next.js App Router, Auth.js Google OAuth, Google APIs, a typed service layer, and OpenAI reasoning for ranking and drafting enhancements. We added Recall.ai scaffolding and webhook verification for provider-grounded meeting artifacts.

### Challenges we ran into

- Keeping live and fallback behavior explicit without degrading UX.
- Handling OAuth token refresh and encrypted refresh token storage safely.
- Preventing overclaiming in meeting experiences when provider evidence is incomplete.
- Balancing deterministic logic with LLM enhancement while preserving reliability.

### Accomplishments that we are proud of

- Polished Briefing + Actions UI with human approval controls.
- Google-first integration flow with clear readiness and scope reporting.
- Honest meeting readiness model that never implies unverified attendance/speaking.
- End-to-end architecture that can evolve from local persistence to production DB.

### What we learned

Trust in AI products is mostly about state transparency: users need to know what came from live systems, what was inferred, and what is still pending.

### What's next for Relay

- Provider-verified meeting joins and artifact ingestion at higher reliability.
- Deeper Drive-aware context in action and drafting flows.
- Stronger persistence and multi-user production hardening.
- Expanded controls for autonomy, approvals, and policy constraints.

## Notes on Experimental Agent Files

This repo includes an isolated meeting-agent prototype and docs:

- lib/agent.ts
- lib/you-model.ts
- lib/claude.ts
- docs/CONNECTING.md
- docs/INTEGRATION.md

These files are preserved for future meeting-bot work and do not replace the current Google-first app flows.
## Deploying to Vercel

The app uses file-based storage (`.relay/*.json`) by default. On Vercel the filesystem is read-only, so persistence is switched to **Vercel KV** (or any Redis that provides `KV_REST_API_URL` and `KV_REST_API_TOKEN`) when those env vars are set.

1. In the [Vercel Dashboard](https://vercel.com/dashboard), open your project → **Storage** → **Create Database**.
2. Create a **KV** store (e.g. Upstash Redis). Link it to your project so Vercel injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. Set your other env vars (e.g. `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, Google OAuth, Recall, OpenAI) in the project’s **Settings → Environment Variables**.
4. Redeploy. The app will use KV for Google tokens, meeting runs, user preferences, drafts, and other stores. Action approval state still uses the filesystem locally; on Vercel it may not persist until that store is migrated to the backend.

**Google sign-in "redirect_uri_mismatch" on Vercel:** Add your app’s callback URL to the OAuth client in Google Cloud Console. See [docs/GOOGLE_OAUTH_VERCEL.md](docs/GOOGLE_OAUTH_VERCEL.md) for the exact URI and steps.

**AI / OpenAI not responding on Vercel:** Set `OPENAI_API_KEY` in the project's Environment Variables and redeploy. To debug failures, use **Runtime Logs**: Vercel Dashboard → project → **Logs**. See [docs/VERCEL_LOGS.md](docs/VERCEL_LOGS.md).
