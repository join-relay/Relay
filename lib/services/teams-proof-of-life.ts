import { APP_NAME, BOT_LABEL } from "@/lib/constants"
import type {
  ProofOfLifeState,
  TeamsJoinAttempt,
  TeamsProofCheckpoint,
  TeamsProofOfLifeStatus,
  TeamsUpcomingMeetingStatus,
  TeamsWebhookEvent,
} from "@/types"

const REQUIRED_ENV_VARS = [
  "PUBLIC_BASE_URL",
  "MICROSOFT_TENANT_ID",
  "MICROSOFT_CLIENT_ID",
  "MICROSOFT_CLIENT_SECRET",
  "MICROSOFT_BOT_APP_ID",
  "MICROSOFT_BOT_APP_PASSWORD",
  "TEAMS_APP_ID",
] as const

let lastWebhookEvent: TeamsWebhookEvent | undefined
let lastJoinAttempt: TeamsJoinAttempt | undefined

function isManualValidationEnabled(value: string | undefined): boolean {
  return value?.toLowerCase() === "true"
}

export function getTeamsWebhookUrl(): string | undefined {
  const explicitEndpoint = process.env.MICROSOFT_BOT_ENDPOINT
  if (explicitEndpoint) return explicitEndpoint

  const publicBaseUrl = process.env.PUBLIC_BASE_URL
  if (!publicBaseUrl) return undefined

  return `${publicBaseUrl.replace(/\/+$/, "")}/api/teams/webhook`
}

function getConfigurationCheckpoint(): TeamsProofCheckpoint {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key])
  if (missing.length > 0) {
    return {
      key: "configured",
      label: "Configured",
      state: "not_configured",
      source: "derived",
      detail:
        "Relay still needs required Teams environment variables before a real proof-of-life attempt can begin.",
      blocker: `Missing: ${missing.join(", ")}`,
    }
  }

  return {
    key: "configured",
    label: "Configured",
    state: "validated",
    source: "derived",
    detail: "Required Teams bot/app environment variables are present for the tenant-installed bot path.",
  }
}

function getWebhookCheckpoint(configuration: TeamsProofCheckpoint): TeamsProofCheckpoint {
  if (configuration.state !== "validated") {
    return {
      key: "webhookReachable",
      label: "Webhook reachable",
      state: "blocked",
      source: "derived",
      detail: "Webhook reachability cannot be validated until the Teams app is configured.",
      blocker: configuration.blocker,
    }
  }

  const webhookUrl = getTeamsWebhookUrl()
  if (!webhookUrl) {
    return {
      key: "webhookReachable",
      label: "Webhook reachable",
      state: "blocked",
      source: "derived",
      detail: "A public webhook URL is required for Teams callbacks.",
      blocker: "Set PUBLIC_BASE_URL or MICROSOFT_BOT_ENDPOINT.",
    }
  }

  if (lastWebhookEvent) {
    return {
      key: "webhookReachable",
      label: "Webhook reachable",
      state: "validated",
      source: "runtime",
      detail: `Received a webhook event of type "${lastWebhookEvent.eventType}" at ${new Date(
        lastWebhookEvent.receivedAt
      ).toLocaleString()}.`,
    }
  }

  if (isManualValidationEnabled(process.env.TEAMS_WEBHOOK_VALIDATED)) {
    return {
      key: "webhookReachable",
      label: "Webhook reachable",
      state: "validated",
      source: "manual",
      detail: "Webhook reachability was marked as manually validated after an external probe.",
    }
  }

  return {
    key: "webhookReachable",
    label: "Webhook reachable",
    state: "pending_external_validation",
    source: "derived",
    detail: `Webhook path is prepared at ${webhookUrl}, but an external Teams/Azure callback has not been observed yet.`,
  }
}

function getTenantInstallCheckpoint(configuration: TeamsProofCheckpoint): TeamsProofCheckpoint {
  if (configuration.state !== "validated") {
    return {
      key: "tenantInstallValidated",
      label: "Tenant/app install validated",
      state: "blocked",
      source: "derived",
      detail: "Tenant install validation is blocked until the Teams app is configured.",
      blocker: configuration.blocker,
    }
  }

  if (isManualValidationEnabled(process.env.TEAMS_TENANT_INSTALL_VALIDATED)) {
    return {
      key: "tenantInstallValidated",
      label: "Tenant/app install validated",
      state: "validated",
      source: "manual",
      detail: "Teams tenant install has been manually confirmed in the target tenant.",
    }
  }

  return {
    key: "tenantInstallValidated",
    label: "Tenant/app install validated",
    state: "pending_external_validation",
    source: "derived",
    detail: "The install path is prepared, but actual tenant validation must be completed outside the app.",
  }
}

function getJoinCheckpoint(configuration: TeamsProofCheckpoint): TeamsProofCheckpoint {
  if (configuration.state !== "validated") {
    return {
      key: "realJoinPathValidated",
      label: "Real join path validated",
      state: "blocked",
      source: "derived",
      detail: "A join validation attempt cannot happen until the Teams app is configured.",
      blocker: configuration.blocker,
    }
  }

  if (isManualValidationEnabled(process.env.TEAMS_REAL_JOIN_VALIDATED)) {
    return {
      key: "realJoinPathValidated",
      label: "Real join path validated",
      state: "validated",
      source: "manual",
      detail: "The real Teams join path has been manually confirmed in the target tenant.",
    }
  }

  if (lastJoinAttempt?.state === "validated") {
    return {
      key: "realJoinPathValidated",
      label: "Real join path validated",
      state: "validated",
      source: "runtime",
      detail: lastJoinAttempt.detail,
    }
  }

  if (lastJoinAttempt) {
    return {
      key: "realJoinPathValidated",
      label: "Real join path validated",
      state: "pending_external_validation",
      source: "runtime",
      detail: lastJoinAttempt.detail,
      blocker:
        lastJoinAttempt.state === "blocked"
          ? "Configuration or target meeting blocked the last join validation attempt."
          : undefined,
    }
  }

  return {
    key: "realJoinPathValidated",
    label: "Real join path validated",
    state: "pending_external_validation",
    source: "derived",
    detail: "No real join validation has been recorded yet. Trigger one after webhook and tenant install setup are ready.",
  }
}

function deriveOverallState(checkpoints: TeamsProofCheckpoint[]): ProofOfLifeState {
  if (checkpoints.some((checkpoint) => checkpoint.state === "not_configured")) {
    return "not_configured"
  }
  if (checkpoints.some((checkpoint) => checkpoint.state === "blocked")) {
    return "blocked"
  }
  if (checkpoints.every((checkpoint) => checkpoint.state === "validated")) {
    return "validated"
  }
  return "pending_external_validation"
}

export function getTeamsProofOfLifeStatus(): TeamsProofOfLifeStatus {
  const configuration = getConfigurationCheckpoint()
  const checkpoints = [
    configuration,
    getWebhookCheckpoint(configuration),
    getTenantInstallCheckpoint(configuration),
    getJoinCheckpoint(configuration),
  ]

  return {
    botIdentity: BOT_LABEL,
    overallState: deriveOverallState(checkpoints),
    webhookUrl: getTeamsWebhookUrl(),
    assumptions: [
      "Hackathon path uses a tenant-installed Teams bot/app only.",
      "Google live meeting discovery is intentionally deferred until after the proof-of-life checkpoint.",
      "This page reports prepared and externally validated states separately; it never fakes proof-of-life success.",
    ],
    manualSteps: [
      "Create Azure app registration and Bot resource.",
      "Expose the webhook path over public HTTPS.",
      "Install the Teams app into the target tenant.",
      "Choose one real Teams meeting target and run a proof-of-life callback or join validation.",
    ],
    runtimeEvidenceNote:
      "Runtime webhook and join evidence is stored in memory only for this phase and will reset when the server restarts.",
    checkpoints,
    lastWebhookEvent,
    lastJoinAttempt,
  }
}

export function getUpcomingTeamsMeetingStatus(): TeamsUpcomingMeetingStatus {
  return {
    state: "blocked",
    detail:
      "Real upcoming Teams meeting discovery depends on Google Calendar integration, which begins after the proof-of-life checkpoint.",
  }
}

export function recordWebhookEvent(
  eventType: string,
  source: TeamsWebhookEvent["source"],
  note: string
): TeamsWebhookEvent {
  lastWebhookEvent = {
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    eventType,
    source,
    note,
  }

  return lastWebhookEvent
}

export function prepareJoinValidation(targetMeeting: string): TeamsJoinAttempt {
  const trimmedMeeting = targetMeeting.trim()
  const status = getTeamsProofOfLifeStatus()
  const configuration = status.checkpoints[0]

  if (!trimmedMeeting) {
    lastJoinAttempt = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      targetMeeting: "",
      state: "blocked",
      detail: "A real Teams meeting link is required to prepare a join validation attempt.",
    }
    return lastJoinAttempt
  }

  if (!trimmedMeeting.includes("teams.microsoft.com")) {
    lastJoinAttempt = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      targetMeeting: trimmedMeeting,
      state: "blocked",
      detail: "Only Microsoft Teams meeting links are valid in this phase.",
    }
    return lastJoinAttempt
  }

  if (configuration.state !== "validated") {
    lastJoinAttempt = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      targetMeeting: trimmedMeeting,
      state: "blocked",
      detail:
        "Teams configuration is incomplete, so the join validation path is scaffolded but not ready to be externally confirmed.",
    }
    return lastJoinAttempt
  }

  if (isManualValidationEnabled(process.env.TEAMS_REAL_JOIN_VALIDATED)) {
    lastJoinAttempt = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      targetMeeting: trimmedMeeting,
      state: "validated",
      detail:
        "Join validation is marked as manually confirmed for this environment. Keep external notes alongside the proof-of-life checkpoint.",
    }
    return lastJoinAttempt
  }

  lastJoinAttempt = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    targetMeeting: trimmedMeeting,
    state: "awaiting_external_validation",
    detail:
      "Join validation has been prepared. The next proof point must come from a real Teams callback, bot event, or external tenant verification.",
  }

  return lastJoinAttempt
}

export function buildTeamsManifest() {
  const botId =
    process.env.MICROSOFT_BOT_APP_ID ||
    process.env.TEAMS_APP_ID ||
    process.env.MICROSOFT_CLIENT_ID
  const publicBaseUrl = process.env.PUBLIC_BASE_URL || "https://example.com"
  const validDomain = publicBaseUrl.replace(/^https?:\/\//, "")

  return {
    manifestVersion: "1.16",
    version: "0.1.0",
    id: process.env.TEAMS_APP_ID || "relay-teams-app-placeholder",
    packageName: "com.relay.hackathon",
    developer: {
      name: APP_NAME,
      websiteUrl: publicBaseUrl,
      privacyUrl: `${publicBaseUrl}/privacy`,
      termsOfUseUrl: `${publicBaseUrl}/terms`,
    },
    name: {
      short: BOT_LABEL,
      full: `${BOT_LABEL} for Microsoft Teams`,
    },
    description: {
      short: "Disclosed Relay participant for Microsoft Teams meetings.",
      full:
        "Relay joins Microsoft Teams meetings as a disclosed assistant, surfaces blocker-aware status, and prepares the path for a real hackathon proof-of-life validation.",
    },
    bots: botId
      ? [
          {
            botId,
            scopes: ["personal", "team", "groupchat"],
            supportsFiles: false,
            isNotificationOnly: false,
          },
        ]
      : [],
    permissions: ["identity", "messageTeamMembers"],
    validDomains: [validDomain],
  }
}
