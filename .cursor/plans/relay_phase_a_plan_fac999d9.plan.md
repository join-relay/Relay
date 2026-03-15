---
name: relay phase a plan
overview: Stabilize the existing Briefing/Actions vertical slice by introducing swappable service boundaries without changing the current UI contracts, then restore a source-controlled Teams proof-of-life slice that honestly reports prepared vs externally validated status for one real Teams path.
todos:
  - id: phase-a-contracts
    content: Stabilize Briefing and Actions behind new service boundary files while preserving existing page/API contracts
    status: completed
  - id: phase-a-db-types
    content: Update types and DB scaffold only as needed for non-breaking future live integration prep
    status: completed
  - id: phase-a5-source-restore
    content: Recreate source-controlled Teams proof-of-life routes and helper logic currently missing from the checked-in tree
    status: completed
  - id: phase-a5-meeting-ui
    content: Replace the placeholder Meeting page with an honest proof-of-life status UI for Yassin's Relay
    status: completed
  - id: phase-a5-external-validation
    content: Perform Azure/Teams tenant setup, webhook validation, install validation, and one real proof-of-life check
    status: pending
isProject: false
---

# Relay Phase A + A.5 Implementation Plan

## Source Of Truth

This plan uses the current checked-in source plus the approved Teams-only replan in `[.cursor/plans/relay_teams_replan_27c3240f.plan.md](.cursor/plans/relay_teams_replan_27c3240f.plan.md)`.

The contracts that must stay stable are already cleanly separated at the page/API boundary:

```9:12:app/(dashboard)/briefing/page.tsx
async function fetchBriefing() {
  const res = await fetch("/api/briefing")
  if (!res.ok) throw new Error("Failed to load briefing")
  return res.json()
}
```

```8:11:app/(dashboard)/actions/page.tsx
async function fetchActions() {
  const res = await fetch("/api/actions")
  if (!res.ok) throw new Error("Failed to load actions")
  return res.json() as Promise<PendingAction[]>
}
```

The main A.5 gap is that the checked-in Meeting page is still a placeholder, while the prior proof-of-life behavior only survives in generated `.next` output:

```1:5:app/(dashboard)/meeting/page.tsx
export default function MeetingPage() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <p className="text-[#3F5363]">Meeting (Phase 3) — Coming soon</p>
```

## Exact Files To Change

### Phase A

- `[app/api/briefing/route.ts](app/api/briefing/route.ts)`
- `[app/api/actions/route.ts](app/api/actions/route.ts)`
- `[app/api/actions/[id]/route.ts](app/api/actions/[id]/route.ts)`
- `[app/api/actions/[id]/approve/route.ts](app/api/actions/[id]/approve/route.ts)`
- `[app/api/actions/[id]/reject/route.ts](app/api/actions/[id]/reject/route.ts)`
- `[lib/mocks/briefing.ts](lib/mocks/briefing.ts)`
- `[lib/mocks/actions.ts](lib/mocks/actions.ts)`
- `[lib/demo/seed.ts](lib/demo/seed.ts)`
- `[lib/db/client.ts](lib/db/client.ts)`
- `[types/index.ts](types/index.ts)`

### Phase A.5

- `[app/(dashboard)/meeting/page.tsx](app/(dashboard)`/meeting/page.tsx)
- `[.env.example](.env.example)`

## Exact Files To Add

### Phase A

- `[lib/services/briefing.ts](lib/services/briefing.ts)`
- `[lib/services/actions.ts](lib/services/actions.ts)`

### Phase A.5

- `[app/api/meeting/status/route.ts](app/api/meeting/status/route.ts)`
- `[app/api/meeting/join/route.ts](app/api/meeting/join/route.ts)`
- `[app/api/meeting/upcoming/route.ts](app/api/meeting/upcoming/route.ts)`
- `[app/api/teams/webhook/route.ts](app/api/teams/webhook/route.ts)`
- `[app/api/teams/manifest/route.ts](app/api/teams/manifest/route.ts)`
- `[components/meeting/MeetingPageHeader.tsx](components/meeting/MeetingPageHeader.tsx)`
- `[components/meeting/IntegrationCheckpointCard.tsx](components/meeting/IntegrationCheckpointCard.tsx)`
- `[components/meeting/JoinValidationPanel.tsx](components/meeting/JoinValidationPanel.tsx)`
- `[lib/services/teams-proof-of-life.ts](lib/services/teams-proof-of-life.ts)`
- `[docs/teams-proof-of-life.md](docs/teams-proof-of-life.md)`

## What Should Remain Untouched

These should stay visually and contractually unchanged during Phase A and A.5:

- `[app/(dashboard)/briefing/page.tsx](app/(dashboard)`/briefing/page.tsx)
- `[app/(dashboard)/actions/page.tsx](app/(dashboard)`/actions/page.tsx)
- `[components/briefing/BriefingCard.tsx](components/briefing/BriefingCard.tsx)`
- `[components/briefing/InboxSummary.tsx](components/briefing/InboxSummary.tsx)`
- `[components/briefing/CalendarSummary.tsx](components/briefing/CalendarSummary.tsx)`
- `[components/briefing/PriorityList.tsx](components/briefing/PriorityList.tsx)`
- `[components/actions/ActionsPageHeader.tsx](components/actions/ActionsPageHeader.tsx)`
- `[components/actions/ActionCard.tsx](components/actions/ActionCard.tsx)`
- `[components/actions/DraftReview.tsx](components/actions/DraftReview.tsx)`
- `[components/actions/ApprovalControls.tsx](components/actions/ApprovalControls.tsx)`
- `[app/(dashboard)/layout.tsx](app/(dashboard)`/layout.tsx)
- `[app/layout.tsx](app/layout.tsx)`
- `[components/layout/Sidebar.tsx](components/layout/Sidebar.tsx)`
- `[components/layout/Header.tsx](components/layout/Header.tsx)`
- `[components/layout/DemoModeIndicator.tsx](components/layout/DemoModeIndicator.tsx)`
- `[components/providers/QueryProvider.tsx](components/providers/QueryProvider.tsx)`
- `[lib/constants.ts](lib/constants.ts)`
- `[lib/mocks/meeting.ts](lib/mocks/meeting.ts)`
- `[project.sql](project.sql)`
- `[package.json](package.json)`
- `[.next/](.next/)`
- `[.cursor/plans/](.cursor/plans/)`

Notes:

- `project.sql` stays reference-only in these phases. No new SQL files should be introduced.
- `.next` is generated output and should not be treated as editable source.
- `package.json` remains untouched unless A.5 is explicitly widened to require a Microsoft SDK; the current proof-of-life slice can be implemented with route logic and env-driven status only.

## Exact Order Of Implementation

1. Preserve the existing data contracts in `[types/index.ts](types/index.ts)` and extend them only where Phase A needs non-breaking metadata for provider-aware meeting state later.
2. Add `[lib/services/briefing.ts](lib/services/briefing.ts)` and move the orchestration currently embedded in `[lib/mocks/briefing.ts](lib/mocks/briefing.ts)` behind a service boundary while keeping the `Briefing` response shape unchanged.
3. Add `[lib/services/actions.ts](lib/services/actions.ts)` and move the orchestration currently embedded in `[lib/mocks/actions.ts](lib/mocks/actions.ts)` behind a service boundary while keeping all four Actions route contracts unchanged.
4. Rewire `[app/api/briefing/route.ts](app/api/briefing/route.ts)` and the four `[app/api/actions/**](app/api/actions/)` routes to call the new service layer instead of importing mock modules directly.
5. Update `[lib/demo/seed.ts](lib/demo/seed.ts)`, `[lib/mocks/briefing.ts](lib/mocks/briefing.ts)`, and `[lib/mocks/actions.ts](lib/mocks/actions.ts)` so they become explicit mock providers used by the new services, not the primary route implementation.
6. Replace the placeholder in `[lib/db/client.ts](lib/db/client.ts)` with a non-destructive DB scaffold that is safe to import now but does not force persistence or schema work in these phases.
7. Validate Phase A in code by confirming Briefing and Actions still render unchanged from the current UI and that edit/approve/reject flows still honor the existing route payloads.
8. Add `[lib/services/teams-proof-of-life.ts](lib/services/teams-proof-of-life.ts)` as the shared A.5 source-of-truth for env validation, webhook URL derivation, checkpoint derivation, last webhook event, and last join-attempt state.
9. Add source-controlled versions of the missing A.5 routes: `[app/api/meeting/status/route.ts](app/api/meeting/status/route.ts)`, `[app/api/meeting/join/route.ts](app/api/meeting/join/route.ts)`, `[app/api/meeting/upcoming/route.ts](app/api/meeting/upcoming/route.ts)`, `[app/api/teams/webhook/route.ts](app/api/teams/webhook/route.ts)`, and `[app/api/teams/manifest/route.ts](app/api/teams/manifest/route.ts)`.
10. Replace the placeholder `[app/(dashboard)/meeting/page.tsx](app/(dashboard)`/meeting/page.tsx) with an honest proof-of-life page composed from `[components/meeting/MeetingPageHeader.tsx](components/meeting/MeetingPageHeader.tsx)`, `[components/meeting/IntegrationCheckpointCard.tsx](components/meeting/IntegrationCheckpointCard.tsx)`, and `[components/meeting/JoinValidationPanel.tsx](components/meeting/JoinValidationPanel.tsx)`.
11. Update `[.env.example](.env.example)` with the exact A.5 variables required by the proof-of-life routes and add `[docs/teams-proof-of-life.md](docs/teams-proof-of-life.md)` to record manual setup, validation evidence, and blockers.
12. Run the external Azure/Teams validation sequence only after the source-controlled A.5 routes are in place.

## Manual / External Setup Steps

These cannot be completed purely in code:

1. Create an Azure App Registration for Relay.
2. Create the Bot registration / Bot Framework resource using the Relay app identity.
3. Expose a public HTTPS URL and point the bot messaging endpoint to `https://<public-base-url>/api/teams/webhook`.
4. Populate the A.5 env values in the deployment environment:
  - `PUBLIC_BASE_URL`
  - `MICROSOFT_TENANT_ID`
  - `MICROSOFT_CLIENT_ID`
  - `MICROSOFT_CLIENT_SECRET`
  - `MICROSOFT_BOT_APP_ID`
  - `MICROSOFT_BOT_APP_PASSWORD`
  - `MICROSOFT_BOT_ENDPOINT` if different from `PUBLIC_BASE_URL`
  - `TEAMS_APP_ID`
5. Generate or copy the Teams app manifest from `[app/api/teams/manifest/route.ts](app/api/teams/manifest/route.ts)`, package it, and install it in the target tenant.
6. Obtain admin consent and any tenant policy approval needed for bot install and meeting participation.
7. Identify one real Microsoft Teams meeting URL for proof-of-life validation.
8. Trigger at least one external callback or validation probe to `[app/api/teams/webhook/route.ts](app/api/teams/webhook/route.ts)`.
9. Attempt one real join-prep flow via `[app/api/meeting/join/route.ts](app/api/meeting/join/route.ts)` using the real Teams meeting URL.
10. Record the evidence and blockers in `[docs/teams-proof-of-life.md](docs/teams-proof-of-life.md)`.

## What Can Be Validated In Code Vs External Setup

### Code-only validation

- `[app/api/briefing/route.ts](app/api/briefing/route.ts)` still returns the same `Briefing` contract.
- `[app/api/actions/route.ts](app/api/actions/route.ts)` and the three mutation routes still return the same `PendingAction` contract and state transitions.
- The new Phase A service modules are the only route dependencies for Briefing and Actions.
- `[app/api/meeting/status/route.ts](app/api/meeting/status/route.ts)` honestly reports `not_configured`, `blocked`, `pending_external_validation`, and `validated` states.
- `[app/api/teams/webhook/route.ts](app/api/teams/webhook/route.ts)` echoes `validationToken` and records runtime evidence for a probe/callback.
- `[app/api/meeting/join/route.ts](app/api/meeting/join/route.ts)` rejects non-Teams URLs and returns honest join-prep state for Teams URLs.
- `[app/api/meeting/upcoming/route.ts](app/api/meeting/upcoming/route.ts)` stays explicitly blocked until real Google Calendar work begins later.
- `[app/(dashboard)/meeting/page.tsx](app/(dashboard)`/meeting/page.tsx) shows prepared vs externally validated states and never implies a live join happened unless validation evidence exists.

### External Azure / Teams validation

- Public webhook reachability from Azure/Teams.
- Bot/app registration correctness.
- Teams manifest install in the actual tenant.
- Tenant policy / admin-consent acceptance.
- One real callback or bot event reaching the webhook.
- One real Teams meeting URL being accepted as the validation target.
- Any real join-path confirmation beyond route-level preparation.

## Blockers And Risks

- The checked-in source for the Teams proof-of-life routes is currently missing; only generated `.next` artifacts show the intended behavior. A.5 must recreate source-controlled versions before any proof-of-life claim is credible.
- The repo is very dirty and contains many generated `.next` artifacts. Those files can obscure what is real source and must stay out of the implementation surface.
- Google Calendar is still mock-only, so upcoming Teams meeting discovery must remain explicitly blocked in A.5.
- A.5 runtime evidence is likely in-memory only at first, so webhook/join evidence will reset on server restart unless explicitly documented externally.
- Azure tenant policy, bot permissions, app install, and callback reachability are the biggest blockers and cannot be solved by local code alone.
- `project.sql` is a commented reference schema; forcing persistence into A or A.5 would widen scope and violate the intended sequencing.

## Definition Of Done

### Phase A

- Briefing and Actions still render with the current design and current page-level fetch/mutation contracts.
- `[app/api/briefing/route.ts](app/api/briefing/route.ts)` and `[app/api/actions/**](app/api/actions/)` no longer import mock providers directly; they use the new service boundary files.
- Mock seed and mock provider files still work as explicit fallback providers under the new service layer.
- `[lib/db/client.ts](lib/db/client.ts)` is safe scaffolding for future live work, not a dead placeholder.
- No SQL files are added, and `[project.sql](project.sql)` remains untouched reference material.

### Phase A.5

- Source-controlled versions of the missing meeting and Teams proof-of-life routes exist under `[app/api/meeting/](app/api/meeting/)` and `[app/api/teams/](app/api/teams/)`.
- `[app/(dashboard)/meeting/page.tsx](app/(dashboard)`/meeting/page.tsx) is no longer a placeholder and visibly distinguishes prepared state from externally validated state for `Yassin's Relay`.
- The webhook route can echo `validationToken` and record at least one probe/callback event in runtime state.
- The join route can validate one real Teams URL and return an honest prep state without faking success.
- The manifest helper can produce a tenant-install helper payload from env values.
- The target tenant has a completed app/bot registration, a reachable public webhook, a validated Teams app install, and one real Teams proof-of-life event or blocker record captured in `[docs/teams-proof-of-life.md](docs/teams-proof-of-life.md)`.

