# Relay
Relay is a disclosed AI chief-of-staff and stunt double for overload moments.

## Current Focus
Relay is currently on the Google-first path:
- Gmail-backed Briefing and Actions
- Google Calendar-backed scheduling and meeting readiness
- OpenAI-assisted email drafting with deterministic fallback when needed

Microsoft Teams is out of scope in the current implementation pass.

## What Changed Most Recently
The latest work focused on making the live Gmail reply flow real, inspectable, and safer:
- live Google-backed actions and briefing routes now load from Gmail and Calendar instead of demo-only data when auth is available
- action state, generated drafts, execution history, user preferences, and dev test state are persisted under `.relay/`
- Gmail reply generation now tracks draft source explicitly: fresh OpenAI, cached OpenAI, cached fallback, or fresh deterministic fallback
- draft generation includes tighter cache binding to the active thread and debug metadata for diagnosis
- a dev-only draft diagnostics route exists at `/api/dev/draft-diagnostics` for tracing a specific live Gmail action
- Playwright coverage was added for live-action flows and draft regressions

## Key Files
- `lib/services/actions.ts`: main live Actions pipeline, draft generation, caching, and final source selection
- `lib/services/gmail.ts`: Gmail thread fetch, active-thread extraction, reply metadata
- `lib/services/openai-reasoning.ts`: OpenAI request handling for drafting and ranking
- `lib/services/email-style.ts`: sent-mail style analysis and stored style profiles
- `app/api/actions/route.ts`: Actions API
- `app/api/actions/[id]/draft/route.ts`: on-demand draft generation
- `app/api/dev/draft-diagnostics/route.ts`: dev-only live draft trace endpoint
- `.relay/generated-drafts.json`: persisted generated draft cache
- `.relay/email-style-profiles.json`: persisted sent-mail style analysis
- `.relay/google-connections.json`: persisted Google OAuth connection state

## Recent Email Drafting Notes
The live Gmail draft path now records enough detail to distinguish:
- `openai_fresh_generation`
- `cached_generated_draft`
- `deterministic_fallback`

Useful metadata lives on `action.personalization.generation`.

If a live Gmail draft falls back, check:
- `fallbackReason`
- `debug.openAISucceeded`
- `debug.openAIError`
- `debug.groundingAccepted`
- `debug.usedCachedDraft`
- `debug.cachedDraftSource`

## Dev Workflow
- `npm run dev`
- `npm run test:e2e`

The app uses `.env.local` for local secrets and runtime config.

## What Still Needs Attention
- broader end-to-end validation across more real signed-in Gmail threads
- continued hardening of grounding and reply-quality checks without losing relevant OpenAI drafts
- cleanup and packaging of the temporary dev diagnostics once the email pipeline is considered stable
