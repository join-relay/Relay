# Teams Proof-of-Life

This document covers only Phase A.5.

## Goal

Prove that Relay has a real Microsoft Teams path without faking validation success.

`Yassin's Relay` must remain explicitly disclosed in the product and in the Teams app metadata.

## What The App Can Prove In Code

- The Meeting page reads source-controlled proof-of-life routes.
- `/api/teams/webhook` can respond to a `validationToken` challenge.
- `/api/teams/webhook` can record a probe or callback event.
- `/api/meeting/join` can reject non-Teams URLs and prepare one Teams join-validation attempt.
- `/api/meeting/status` separates prepared state from externally validated state.
- `/api/meeting/upcoming` stays blocked until Google Calendar is implemented later.

## Important Limitation

Webhook and join runtime evidence is stored in memory only in Phase A.5.

That means:

- Evidence resets when the dev server or deployment restarts.
- Runtime events are useful for a short proof-of-life spike, not as durable audit storage.
- External validation evidence should also be recorded outside the app while this limitation remains.

## Required Environment Variables

- `PUBLIC_BASE_URL`
- `MICROSOFT_TENANT_ID`
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_BOT_APP_ID`
- `MICROSOFT_BOT_APP_PASSWORD`
- `MICROSOFT_BOT_ENDPOINT` if different from `PUBLIC_BASE_URL`
- `TEAMS_APP_ID`

Optional manual flags for the spike:

- `TEAMS_WEBHOOK_VALIDATED=true`
- `TEAMS_TENANT_INSTALL_VALIDATED=true`
- `TEAMS_REAL_JOIN_VALIDATED=true`

These flags should only be set when the matching external validation really happened.

## External Checklist

1. Create the Azure App Registration for Relay.
2. Create the Bot registration / Bot Framework resource.
3. Set the public messaging endpoint to `/api/teams/webhook`.
4. Generate the manifest helper from `/api/teams/manifest`.
5. Package and install the Teams app in the target tenant.
6. Confirm admin consent and tenant policy requirements.
7. Choose one real Teams meeting URL for validation.
8. Trigger at least one webhook probe or real callback.
9. Run one join-validation attempt against the real Teams URL.
10. Record whether each checkpoint is truly validated or still blocked.

## Honest Validation Rules

- Do not mark a checkpoint as validated unless an external proof point exists.
- Do not imply Relay joined a meeting if only route-level preparation happened.
- Do not imply webhook reachability if only local code exists without a public callback.
- Do not imply upcoming meeting discovery is live before Google Calendar work begins.
