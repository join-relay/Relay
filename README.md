# Relay

Relay is a disclosed AI chief-of-staff and overload copilot with a Google-first product path.

## Current Product State

- Gmail-backed Briefing and Actions are the current source of truth.
- Google Calendar powers scheduling context and Meeting readiness discovery.
- OpenAI-assisted reply drafting stays explicit about fresh, cached, and deterministic fallback paths.
- Settings, History, login, and the polished dashboard shell remain the live product surfaces.
- Microsoft Teams is out of scope for the current implementation pass.

## Meeting Direction

The current Meeting page is an honest readiness surface:

- Google Meet discovery is live when Calendar auth and data are available.
- Recall.ai now has minimal provider scaffolding and readiness reporting only.
- Relay does not claim to join, speak in, or summarize a meeting without real provider evidence.

## Useful Experimental Work Kept Isolated

The repository also contains an isolated meeting-agent prototype:

- `lib/agent.ts`
- `lib/you-model.ts`
- `lib/claude.ts`
- `docs/CONNECTING.md`
- `docs/INTEGRATION.md`

These files are preserved for future meeting-bot work, but they do not replace the current Google-first app flows.

## Key Runtime Areas

- `app/(dashboard)/*`: live UI surfaces
- `app/api/actions/*`: action generation and approval
- `app/api/meeting/*`: meeting readiness and provider scaffolding
- `lib/services/gmail.ts`: Gmail reads and reply context
- `lib/services/actions.ts`: draft generation and action orchestration
- `lib/services/meeting-readiness.ts`: honest meeting readiness state
- `lib/services/recall.ts`: minimal Recall.ai provider foundation

## Local Development

```bash
npm install
npm run dev
```

Useful checks:

- `npm run typecheck`
- `npm run test`
- `npm run test:e2e`

Local secrets live in `.env.local`. Use `.env.example` as the server-side config reference.
