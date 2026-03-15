import { createHash } from "node:crypto"
import { getOptionalSession } from "@/auth"
import { getRelayPersonalization } from "@/lib/services/email-style"
import {
  getConflictingEvents,
  getLiveCalendarEvents,
  isGoogleMeetEvent,
  patchCalendarEvent,
} from "@/lib/services/calendar"
import {
  getGmailThreadContext,
  getLiveGmailThreadById,
  getLiveGmailThreads,
  sendEmail,
  stripQuotedReplyText,
} from "@/lib/services/gmail"
import { getBaseGoogleIntegrationStatus } from "@/lib/services/google-auth"
import {
  generateDraftEmailBody,
  getConfiguredReasoningModel,
  hasOpenAIReasoning,
} from "@/lib/services/openai-reasoning"
import {
  getActionStatus,
  getStoredActionById,
  getStoredActions,
  mergeActionWithStore,
  rememberActionBases,
  seededActions,
  setActionApproved,
  setActionEditedContent,
  setActionRejected,
} from "@/lib/mocks/actions"
import { appendActionExecution } from "@/lib/persistence/action-executions"
import {
  listGeneratedDraftsForUser,
  saveGeneratedDraft,
} from "@/lib/persistence/generated-drafts"
import type {
  ActionExecutionRecord,
  ActionOrigin,
  ActionProvenance,
  ActionSourceIdentifiers,
  ActionType,
  ActionsViewState,
  CalendarEvent,
  DraftEmailPayload,
  EmailStyleProfile,
  GmailThread,
  GmailThreadContext,
  PendingAction,
  RelayCustomizationSettings,
  RescheduleMeetingPayload,
} from "@/types"

type ReviewedContent = DraftEmailPayload | RescheduleMeetingPayload
type PendingActionBase = Omit<
  PendingAction,
  "status" | "reviewedContent" | "executedAt" | "executionSummary"
>

const DEMO_SIGNATURE_NAME = "Yassin"
const LIVE_EMAIL_ACTION_PREFIX = "gmail:"
const LIVE_CALENDAR_ACTION_PREFIX = "calendar:"
const LIVE_ACTION_THREAD_LIMIT = 14
const MAX_SELECTED_EMAIL_ACTIONS = 3
const GENERATED_DRAFT_CACHE_VERSION = 4
const SIGN_OFF_LINE_PATTERN =
  /^(best regards|best|thanks|thank you|regards|kind regards|sincerely|warmly)[,!]?\s*$/i
const COMMON_NON_PERSON_NAME_TOKENS = new Set([
  "team",
  "support",
  "help",
  "hello",
  "hi",
  "finance",
  "billing",
  "calendar",
  "notifications",
  "notification",
  "recruiting",
  "recruiter",
  "sales",
  "success",
  "operations",
  "ops",
  "admin",
  "assistant",
  "info",
])
const NAME_PREFIX_TOKENS = new Set(["mr", "mrs", "ms", "miss", "dr", "prof"])
const GENERIC_REPLY_TOKENS = new Set([
  "about",
  "again",
  "appreciate",
  "available",
  "best",
  "can",
  "confirm",
  "confirmed",
  "follow",
  "following",
  "for",
  "from",
  "good",
  "happy",
  "hello",
  "hey",
  "hi",
  "hop",
  "know",
  "let",
  "looking",
  "me",
  "note",
  "ok",
  "okay",
  "on",
  "play",
  "question",
  "reply",
  "respond",
  "shortly",
  "side",
  "soon",
  "sounds",
  "thanks",
  "that",
  "the",
  "this",
  "time",
  "timing",
  "up",
  "weekend",
  "will",
  "work",
  "works",
])

function parseCalendarSourceIdentifiers(compositeId: string): ActionSourceIdentifiers {
  const colon = compositeId.indexOf(":")
  if (colon >= 0) {
    return {
      calendarId: compositeId.slice(0, colon) || "primary",
      calendarEventId: compositeId.slice(colon + 1) || compositeId,
    }
  }

  return {
    calendarId: "primary",
    calendarEventId: compositeId,
  }
}

function inferActionProvenance(base: {
  id: string
  type: ActionType
  proposedAction: DraftEmailPayload | RescheduleMeetingPayload
  provenance?: ActionProvenance
}): ActionProvenance {
  if (base.provenance) return base.provenance

  if (base.id.startsWith(LIVE_EMAIL_ACTION_PREFIX)) {
    const payload = base.proposedAction as DraftEmailPayload
    return {
      provider: "gmail",
      sourceType: "gmail_thread",
      origin: "live",
      sourceIdentifiers: {
        gmailThreadId: payload.threadId,
      },
    }
  }

  if (base.id.startsWith(LIVE_CALENDAR_ACTION_PREFIX)) {
    const payload = base.proposedAction as RescheduleMeetingPayload
    return {
      provider: "google_calendar",
      sourceType: "calendar_event",
      origin: "live",
      sourceIdentifiers: parseCalendarSourceIdentifiers(payload.eventId),
    }
  }

  return {
    provider: "mock",
    sourceType: "demo_fallback",
    origin: "mock",
    sourceIdentifiers: {
      demoActionId: base.id,
    },
  }
}

function withNormalizedProvenance(base: PendingActionBase): PendingActionBase {
  return {
    ...base,
    provenance: inferActionProvenance(base),
  }
}

function canExecuteLive(origin: ActionOrigin, provider: ActionProvenance["provider"]) {
  return origin === "live" && (provider === "gmail" || provider === "google_calendar")
}

function parseEmailAddress(from?: string | null) {
  if (!from) return undefined
  const bracketMatch = from.match(/<([^>]+)>/)
  if (bracketMatch?.[1]) return bracketMatch[1].trim().toLowerCase()

  const emailMatch = from.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return emailMatch?.[0]?.toLowerCase()
}

function parseSenderName(from: string) {
  const cleaned = from
    .replace(/<[^>]+>/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replaceAll('"', "")
    .replace(/\s+/g, " ")
    .trim()
  if (!cleaned || /@/.test(cleaned) || /\d/.test(cleaned)) return null
  if (cleaned.length > 60) return null
  if (/[|/\\]/.test(cleaned)) return null

  const tokens = cleaned
    .split(/\s+/)
    .map((token) => token.replace(/^[^A-Za-z]+|[^A-Za-z'.-]+$/g, ""))
    .filter(Boolean)
  if (tokens.length === 0 || tokens.length > 3) return null
  if (tokens.some((token) => COMMON_NON_PERSON_NAME_TOKENS.has(token.toLowerCase()))) return null

  const firstMeaningfulToken =
    tokens.find((token) => !NAME_PREFIX_TOKENS.has(token.replace(/\./g, "").toLowerCase())) ?? tokens[0]
  if (!firstMeaningfulToken) return null
  if (!/^[A-Za-z][A-Za-z'.-]*$/.test(firstMeaningfulToken)) return null

  return normalizeFirstNameToken(firstMeaningfulToken)
}

function normalizeFirstNameToken(token: string) {
  const trimmed = token.replace(/^[^A-Za-z]+|[^A-Za-z'.-]+$/g, "")
  if (!trimmed) return null
  if (COMMON_NON_PERSON_NAME_TOKENS.has(trimmed.toLowerCase())) return null
  if (/^[A-Z]{2,}$/.test(trimmed)) {
    return `${trimmed[0]}${trimmed.slice(1).toLowerCase()}`
  }
  return `${trimmed[0]?.toUpperCase() ?? ""}${trimmed.slice(1)}`
}

function extractFirstNameFromSignatureLine(line: string) {
  const cleaned = line
    .replace(/^[~,\-–—.\s]+|[~,\-–—.\s]+$/g, "")
    .split(/\s+\|\s+|\s+\/\s+|\s+-\s+/)[0]
    ?.trim()

  if (!cleaned) return null
  if (/@|https?:\/\/|www\.|linkedin|calendar|zoom|meet\.google/i.test(cleaned)) return null
  if (/\d/.test(cleaned)) return null

  const tokens = cleaned
    .split(/\s+/)
    .map((token) => token.replace(/^[^A-Za-z]+|[^A-Za-z'.-]+$/g, ""))
    .filter(Boolean)
  if (tokens.length === 0 || tokens.length > 3) return null

  const meaningfulTokens = tokens.filter(
    (token) => !NAME_PREFIX_TOKENS.has(token.replace(/\./g, "").toLowerCase())
  )
  const firstToken = meaningfulTokens[0]
  if (!firstToken) return null
  if (!/^[A-Za-z][A-Za-z'.-]*$/.test(firstToken)) return null
  if (COMMON_NON_PERSON_NAME_TOKENS.has(firstToken.toLowerCase())) return null

  return normalizeFirstNameToken(firstToken)
}

function extractSignatureFirstName(bodyText?: string | null) {
  const normalized = bodyText?.replace(/\r\n/g, "\n").trim()
  if (!normalized) return null

  const blocks = normalized
    .split(/\n\s*\n/)
    .map((block) => block.split("\n").map((line) => line.trim()).filter(Boolean))
    .filter((block) => block.length > 0)
  if (blocks.length === 0) return null

  const tailLines = blocks.flat().slice(-8)
  for (let index = tailLines.length - 2; index >= 0; index -= 1) {
    if (!isSignOffLine(tailLines[index])) continue
    const candidate = extractFirstNameFromSignatureLine(tailLines[index + 1] ?? "")
    if (candidate) {
      return {
        name: candidate,
        confidence: 0.96,
        source: "signature" as const,
      }
    }
  }

  const finalBlock = blocks.at(-1)
  if (!finalBlock || finalBlock.length > 3 || blocks.length < 2) return null

  const signatureCandidate = extractFirstNameFromSignatureLine(finalBlock[0] ?? "")
  if (!signatureCandidate) return null

  const hasSignatureShape =
    finalBlock.length >= 2 &&
    finalBlock[0].split(/\s+/).filter(Boolean).length <= 2 &&
    finalBlock
      .slice(1)
      .every((line) => !/[.!?]$/.test(line) && line.length <= 48)
  if (!hasSignatureShape) return null

  return {
    name: signatureCandidate,
    confidence: finalBlock.length >= 2 ? 0.9 : 0.86,
    source: "signature" as const,
  }
}

function resolveRecipientName(params: {
  thread: GmailThread
  latestInbound?: GmailThreadContext["messages"][number] | null
}) {
  const signatureCandidate = extractSignatureFirstName(
    params.latestInbound?.bodyText ?? params.latestInbound?.bodyPreview
  )
  if (signatureCandidate && signatureCandidate.confidence >= 0.9) {
    return signatureCandidate.name
  }

  const headerName = parseSenderName(params.latestInbound?.from ?? params.thread.from)
  if (headerName) return headerName

  return "there"
}

function isSignOffLine(line?: string | null) {
  return Boolean(line && SIGN_OFF_LINE_PATTERN.test(line.trim()))
}

function stripReplyBoilerplate(text: string) {
  return text
    .replace(/^(hi|hello|hey)\s+[a-z .'-]+,?\s*/i, "")
    .replace(/\nOn .+wrote:\n[\s\S]*$/i, "")
    .replace(/\nFrom:\s.+\nSent:\s.+\nTo:\s.+\nSubject:\s.+[\s\S]*$/i, "")
    .replace(/\n-{2,}\s*Original Message\s*-{2,}\n[\s\S]*$/i, "")
    .replace(/\n>.+$/im, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function extractMessageFocus(messageText: string, fallbackSubject: string) {
  const normalized = stripReplyBoilerplate(messageText)
  const firstSentence = normalized.split(/[.!?](?:\s|$)/)[0]?.trim()
  const candidate = firstSentence && firstSentence.length >= 12 ? firstSentence : fallbackSubject
  return candidate.length > 120 ? `${candidate.slice(0, 117).trimEnd()}...` : candidate
}

function normalizeReplySubject(subject: string) {
  return /^re:/i.test(subject) ? subject : `Re: ${subject}`
}

function normalizeDraftingText(value?: string | null) {
  return value
    ?.replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function clipDraftingText(value: string, maxLength = 420) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength).trimEnd()}...`
}

function getSanitizedMessageText(message?: GmailThreadContext["messages"][number] | null) {
  const rawText = message?.bodyText ?? message?.bodyPreview ?? message?.snippet ?? ""
  const cleaned = normalizeDraftingText(stripQuotedReplyText(rawText))
  if (cleaned) return cleaned

  return normalizeDraftingText(stripQuotedReplyText(message?.snippet ?? ""))
}

function normalizeThreadContextForDrafting(threadContext?: GmailThreadContext | null) {
  if (!threadContext) return null

  const messages = threadContext.messages.map((message) => {
    const activeText = getSanitizedMessageText(message) ?? ""
    const preview = activeText ? clipDraftingText(activeText) : message.bodyPreview || message.snippet

    return {
      ...message,
      snippet: activeText || message.snippet,
      bodyPreview: preview || undefined,
      bodyText: activeText || undefined,
    }
  })
  const latestMessage = messages.at(-1)

  return {
    ...threadContext,
    preview:
      latestMessage?.bodyPreview ??
      latestMessage?.snippet ??
      normalizeDraftingText(stripQuotedReplyText(threadContext.preview)) ??
      threadContext.preview,
    messages,
  }
}

function buildActiveThreadText(thread: GmailThread, threadContext?: GmailThreadContext | null) {
  const recentMessages =
    threadContext?.messages
      .slice(-4)
      .map((message) => {
        const body = getSanitizedMessageText(message) ?? message.snippet ?? ""
        return [
          `from: ${message.from}`,
          `to: ${message.to ?? "(not available)"}`,
          `body: ${body || "(empty)"}`,
        ].join("\n")
      })
      .join("\n\n---\n\n") ?? ""

  return recentMessages || `subject: ${thread.subject}\nsnippet: ${thread.snippet || "(empty)"}`
}

function buildGroundingContextText(params: {
  thread: GmailThread
  threadContext?: GmailThreadContext | null
  latestInbound?: { bodyPreview?: string; bodyText?: string; snippet?: string } | null
}) {
  const recentActiveMessages =
    params.threadContext?.messages
      .slice(-4)
      .map((message) => getSanitizedMessageText(message) ?? message.snippet)
      .filter(Boolean) ?? []

  return [
    params.thread.subject,
    params.thread.snippet,
    normalizeDraftingText(
      stripQuotedReplyText(
        params.latestInbound?.bodyText ??
          params.latestInbound?.bodyPreview ??
          params.latestInbound?.snippet ??
          ""
      )
    ),
    params.threadContext?.preview,
    ...recentActiveMessages,
  ]
    .filter(Boolean)
    .join(" ")
}

function shouldDebugDraftAction(actionId: string) {
  const targetActionId = process.env.RELAY_DEBUG_ACTION_ID?.trim()
  return process.env.NODE_ENV !== "production" || Boolean(targetActionId && targetActionId === actionId)
}

function logDraftDebug(actionId: string, stage: string, payload: Record<string, unknown>) {
  if (!shouldDebugDraftAction(actionId)) return
  console.info(
    `[relay:draft-debug] ${JSON.stringify(
      {
        actionId,
        stage,
        ...payload,
      },
      null,
      2
    )}`
  )
}

function describeReplyTone(
  settings: RelayCustomizationSettings,
  styleProfile: EmailStyleProfile
) {
  return `${settings.emailTone}/${settings.emailFormality}, ${settings.emailConciseness}, ${styleProfile.signOffStyle} sign-off, ${styleProfile.punctuationStyle} punctuation`
}

function buildPersonalizationSummary(
  settings: RelayCustomizationSettings,
  styleProfile: EmailStyleProfile
) {
  const sourceLabel =
    styleProfile.source === "sent_mail" ? "Sent-mail style + saved settings" : "Saved settings + default style"
  const structure =
    styleProfile.structuralHabits.length > 0
      ? styleProfile.structuralHabits.slice(0, 2).join("; ")
      : "keeps replies concise"
  return `${sourceLabel}: ${describeReplyTone(settings, styleProfile)}; em dash ${
    styleProfile.usesEmDash ? "on" : "off"
  }; signature ${styleProfile.signatureUsage}; ${structure}`
}

function extractLatestInboundMessage(
  thread: GmailThread,
  threadContext: GmailThreadContext | null | undefined,
  userEmail?: string | null
) {
  const normalizedUserEmail = parseEmailAddress(userEmail ?? undefined) ?? userEmail?.trim().toLowerCase()
  const normalizedThreadSender = parseEmailAddress(thread.from)

  if (!threadContext) return null

  return (
    threadContext.messages
      .slice()
      .reverse()
      .find((message) => {
        const senderEmail = parseEmailAddress(message.from)
        if (!senderEmail) return false
        if (normalizedUserEmail && senderEmail === normalizedUserEmail) return false
        if (normalizedThreadSender && senderEmail !== normalizedThreadSender) return false
        return true
      }) ??
    threadContext.messages
      .slice()
      .reverse()
      .find((message) => {
        const senderEmail = parseEmailAddress(message.from)
        return Boolean(senderEmail && senderEmail !== normalizedUserEmail)
      }) ??
    null
  )
}

function deriveReplyIdentity(params: {
  thread: GmailThread
  threadContext?: GmailThreadContext | null
  userEmail?: string | null
  displayName: string
}) {
  const latestInbound = extractLatestInboundMessage(params.thread, params.threadContext, params.userEmail)
  const replyTargetHeader = latestInbound?.from ?? params.thread.from

  return {
    authorDisplayName: params.displayName,
    authorEmail: parseEmailAddress(params.userEmail ?? undefined) ?? params.userEmail?.trim().toLowerCase(),
    recipientName: resolveRecipientName({
      thread: params.thread,
      latestInbound,
    }),
    recipientEmail: parseEmailAddress(replyTargetHeader),
    latestInbound,
  }
}

function buildGreeting(
  senderName: string,
  settings: RelayCustomizationSettings,
  styleProfile: EmailStyleProfile
) {
  if (!settings.includeGreeting) return ""

  switch (styleProfile.greetingStyle) {
    case "formal":
      return `Hello ${senderName},`
    case "casual":
      return `Hey ${senderName},`
    case "minimal":
      return `${senderName},`
    case "none":
      return ""
    case "warm":
    default:
      return `Hi ${senderName},`
  }
}

function buildAcknowledgementLine(styleProfile: EmailStyleProfile) {
  const lowerPhrases = styleProfile.commonPhrases.map((phrase) => phrase.toLowerCase())
  if (styleProfile.formality === "formal" || styleProfile.greetingStyle === "formal") {
    if (lowerPhrases.includes("thank you for the email")) {
      return "Thank you for the email."
    }
    return "Thank you for the note."
  }

  if (styleProfile.tone === "warm" || styleProfile.tone === "friendly") {
    return "Thanks for the note."
  }

  return ""
}

function getPreferredSignatureBlock(
  displayName: string,
  settings: RelayCustomizationSettings,
  styleProfile: EmailStyleProfile
) {
  const explicitOverride = settings.emailSignatureOverride?.trim()
  if (explicitOverride) return explicitOverride
  if (!settings.useSignature) return undefined
  if (styleProfile.signatureUsage === "none") return undefined

  return (
    styleProfile.signatureBlock?.trim() ||
    styleProfile.styleAnchors.signatureExamples[0]?.trim() ||
    displayName
  )
}

function buildResponseSentence(
  subject: string,
  thread: GmailThread,
  settings: RelayCustomizationSettings,
  styleProfile: EmailStyleProfile,
  threadContext?: GmailThreadContext | null,
  userEmail?: string | null
) {
  const latestMessage = extractLatestInboundMessage(thread, threadContext, userEmail)
  const messageText = `${latestMessage?.bodyPreview ?? ""} ${thread.snippet}`.trim()
  const focus = extractMessageFocus(messageText, subject)
  const mentionsUrgency = /(urgent|asap|eod|today|deadline|approve|approval)/i.test(
    `${thread.subject} ${messageText}`
  )
  const asksQuestion = /\?/.test(messageText)
  const asksApproval = /(approve|approval|sign off|confirm)/i.test(messageText)
  const mentionsReschedule = /(resched|move|tomorrow|availability|works for you|time)/i.test(messageText)

  if (settings.emailTone === "direct" || styleProfile.directness === "high") {
    if (mentionsUrgency) {
      return `I saw the request about ${focus} and will reply today.`
    }
    if (asksApproval) {
      return `I saw the request to confirm ${focus} and will respond shortly.`
    }
    if (asksQuestion) {
      return `I saw your question about ${focus} and will reply shortly.`
    }
    return `I saw your note about ${focus} and will follow up shortly.`
  }

  if (settings.emailTone === "friendly") {
    return mentionsUrgency
      ? `Thanks for flagging ${focus}. I saw the request and will get back to you today.`
      : mentionsReschedule
        ? `Thanks for the note about ${focus}. I saw the timing change and will get back to you soon.`
        : `Thanks for the note about ${focus}. I saw it and will get back to you soon.`
  }

  if (mentionsUrgency) {
    return `Thanks for sending this over. I saw the request about ${focus} and will follow up today.`
  }

  if (asksApproval) {
    return `Thanks for sending this over. I saw the request to confirm ${focus} and will follow up shortly.`
  }

  if (focus && asksQuestion && settings.emailConciseness !== "brief") {
    return `Thanks for the note. I saw your question about ${focus} and will follow up shortly.`
  }

  return settings.emailConciseness === "detailed"
    ? `Thanks for the note about ${focus}. I saw it and will follow up shortly with the next step.`
    : `Thanks for the note about ${focus}. I will follow up shortly.`
}

function buildSignOff(
  displayName: string,
  settings: RelayCustomizationSettings,
  styleProfile: EmailStyleProfile,
  preferredSignatureBlock?: string
) {
  const lines: string[] = []
  const explicitSignOffExample = styleProfile.styleAnchors.signOffExamples[0]?.trim()
  const signatureLines = preferredSignatureBlock
    ?.split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean) ?? []
  const signatureStartsWithSignOff = signatureLines.length > 0 && isSignOffLine(signatureLines[0])

  if (settings.includeSignOff && !signatureStartsWithSignOff) {
    if (explicitSignOffExample) {
      lines.push(explicitSignOffExample)
    } else {
      switch (styleProfile.signOffStyle) {
        case "best_regards":
          lines.push("Best regards,")
          break
        case "thanks":
          lines.push("Thanks,")
          break
        case "regards":
          lines.push("Regards,")
          break
        case "name_only":
          break
        case "none":
          break
        case "best":
        default:
          lines.push("Best,")
          break
      }
    }
  }

  if (settings.useSignature && preferredSignatureBlock) {
    const normalizedExistingLastLine = lines.at(-1)?.replace(/[!,]/g, "").trim().toLowerCase()
    const normalizedSignatureFirstLine = signatureLines[0]
      ?.replace(/[!,]/g, "")
      .trim()
      .toLowerCase()

    if (
      normalizedExistingLastLine &&
      normalizedSignatureFirstLine &&
      normalizedExistingLastLine === normalizedSignatureFirstLine
    ) {
      lines.push(signatureLines.slice(1).join("\n"))
    } else {
      lines.push(preferredSignatureBlock)
    }
  } else if (settings.includeSignOff && styleProfile.signOffStyle === "name_only") {
    lines.push(displayName)
  }

  return lines.filter(Boolean)
}

function styleJoin(parts: string[], styleProfile: EmailStyleProfile) {
  const separator = styleProfile.usesEmDash ? " — " : ", "
  return parts.filter(Boolean).join(separator)
}

function normalizeDraftEmDashPreference(body: string, usesEmDash: boolean) {
  if (usesEmDash) return body

  return body
    .replace(/\s+—\s+/g, ", ")
    .replace(/\s*—\s*\n/g, "\n")
    .replace(/\n\s*—\s*/g, "\n")
    .replace(/—/g, ", ")
    .replace(/,\s*,/g, ", ")
    .replace(/\s+,/g, ",")
    .replace(/,([.!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function stripGeneratedReplyFraming(body: string) {
  const normalized = body.replace(/\r\n/g, "\n").trim()
  if (!normalized) return ""

  const lines = normalized
    .split("\n")
    .map((line) => line.trimEnd())

  if (
    lines[0] &&
    /^(hi|hello|hey|dear)\b/i.test(lines[0])
  ) {
    lines.shift()
    while (lines[0] === "") {
      lines.shift()
    }
  }

  const closingMarkerIndex = lines.findIndex((line) => isSignOffLine(line))
  if (closingMarkerIndex >= 0) {
    lines.splice(closingMarkerIndex)
  }

  return lines.join("\n").trim()
}

function assembleDraftBody(params: {
  coreBody: string
  recipientName: string
  displayName: string
  settings: RelayCustomizationSettings
  styleProfile: EmailStyleProfile
}) {
  const greeting = buildGreeting(params.recipientName, params.settings, params.styleProfile)
  const signOffLines = buildSignOff(
    params.displayName,
    params.settings,
    params.styleProfile,
    getPreferredSignatureBlock(params.displayName, params.settings, params.styleProfile)
  )

  return normalizeDraftEmDashPreference(
    [greeting, params.coreBody.trim(), signOffLines.join("\n")]
      .filter((section) => section && section.trim().length > 0)
      .join("\n\n"),
    params.styleProfile.usesEmDash
  )
}

function buildStyleFingerprint(styleProfile: EmailStyleProfile) {
  return {
    profileVersion: styleProfile.profileVersion,
    source: styleProfile.source,
    greetingStyle: styleProfile.greetingStyle,
    tone: styleProfile.tone,
    formality: styleProfile.formality,
    sentenceLength: styleProfile.sentenceLength,
    averageSentenceLengthWords: styleProfile.averageSentenceLengthWords,
    directness: styleProfile.directness,
    punctuationStyle: styleProfile.punctuationStyle,
    capitalizationStyle: styleProfile.capitalizationStyle,
    usesEmDash: styleProfile.usesEmDash,
    usesBullets: styleProfile.usesBullets,
    signOffStyle: styleProfile.signOffStyle,
    signatureUsage: styleProfile.signatureUsage,
    signatureBlock: styleProfile.signatureBlock ?? "",
    commonPhrases: styleProfile.commonPhrases,
    structuralHabits: styleProfile.structuralHabits,
    formattingHabits: styleProfile.formattingHabits,
    styleAnchors: styleProfile.styleAnchors,
  }
}

function buildDraftCacheKey(params: {
  threadId: string
  latestMessageId?: string
  activeThreadText: string
  settings: RelayCustomizationSettings
  styleProfile: EmailStyleProfile
}) {
  const generationState = hasOpenAIReasoning() ? getConfiguredReasoningModel() : "deterministic_fallback"
  const fingerprint = JSON.stringify({
    cacheVersion: GENERATED_DRAFT_CACHE_VERSION,
    threadId: params.threadId,
    latestMessageId: params.latestMessageId ?? "",
    activeThreadText: params.activeThreadText,
    settings: params.settings,
    style: buildStyleFingerprint(params.styleProfile),
    generationState,
  })

  return createHash("sha256").update(fingerprint).digest("hex")
}

function buildEmailOriginalContext(threadContext: GmailThreadContext | null | undefined) {
  return threadContext
    ? {
        kind: "gmail_thread" as const,
        preview: threadContext.preview,
        thread: threadContext,
      }
    : undefined
}

function getThreadKeywordScore(thread: GmailThread) {
  const text = `${thread.subject} ${thread.snippet}`.toLowerCase()
  let score = 0
  if (/(urgent|asap|eod|today|deadline|approve|approval|confirm|follow up|follow-up)/.test(text)) {
    score += 4
  }
  if (/(question|\?)/.test(text)) score += 2
  if (/(resched|move|availability|calendar|meeting)/.test(text)) score += 1
  return score
}

function getThreadRecencyScore(thread: GmailThread) {
  const ageMs = Date.now() - new Date(thread.date).getTime()
  const ageHours = ageMs / (1000 * 60 * 60)
  if (ageHours <= 6) return 4
  if (ageHours <= 24) return 3
  if (ageHours <= 72) return 2
  if (ageHours <= 168) return 1
  return -1
}

function isLikelyAutomatedAddress(address: string) {
  return /(no-?reply|noreply|notifications?@|mailer-daemon|calendar-notification|donotreply)/i.test(
    address
  )
}

function getThreadCandidateScore(thread: GmailThread) {
  let score = getThreadKeywordScore(thread) + getThreadRecencyScore(thread)
  if (thread.isUnread) score += 6
  if (thread.labels?.includes("IMPORTANT")) score += 2
  if (/^re:/i.test(thread.subject)) score += 1
  return score
}

function getEmailUrgency(score: number, thread: GmailThread): PendingAction["urgency"] {
  if (thread.isUnread && score >= 8) return "urgent"
  if (thread.isUnread || score >= 5) return "important"
  return "low"
}

function buildDraftCoreBody(
  thread: GmailThread,
  settings: RelayCustomizationSettings,
  styleProfile: EmailStyleProfile,
  threadContext?: GmailThreadContext | null,
  userEmail?: string | null
) {
  const subject = thread.subject === "(No subject)" ? "your note" : thread.subject
  const responseLine = buildResponseSentence(
    subject,
    thread,
    settings,
    styleProfile,
    threadContext,
    userEmail
  )
  const latestInbound = extractLatestInboundMessage(thread, threadContext, userEmail)
  const followUpLine =
    settings.emailConciseness === "brief"
      ? ""
      : /(deadline|today|asap|urgent)/i.test(`${thread.subject} ${latestInbound?.bodyPreview ?? ""}`)
        ? "I am treating this as time-sensitive."
        : /(approve|confirm|question|\?)/i.test(latestInbound?.bodyPreview ?? thread.snippet)
          ? "I will respond with the right detail in my next follow-up."
          : styleProfile.directness === "high"
            ? "I will send the next step shortly."
            : ""
  const commonPhrase =
    styleProfile.commonPhrases.find((phrase) => /let me know|sounds good|happy to|appreciate it/.test(phrase)) ??
    null
  const acknowledgementLine = buildAcknowledgementLine(styleProfile)
  const followUpWithStyle =
    commonPhrase && followUpLine
      ? styleJoin(
          [
            followUpLine,
            commonPhrase === "let me know"
              ? "Let me know if you want me to cover anything specific."
              : commonPhrase === "sounds good"
                ? "Sounds good on my side."
                : commonPhrase === "happy to"
                  ? "Happy to send more detail if helpful."
                  : "Appreciate it.",
          ],
          styleProfile
        )
      : followUpLine

  return normalizeDraftEmDashPreference(
    [acknowledgementLine, responseLine, followUpWithStyle]
      .filter((section) => section && section.trim().length > 0)
      .join("\n\n"),
    styleProfile.usesEmDash
  )
}

function tokenizeRelevantWords(text: string) {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .match(/[a-z0-9]{4,}/g)
        ?.filter((token) => !["this", "that", "with", "from", "have", "will", "your", "thanks"].includes(token)) ??
        []
    )
  )
}

function generatedBodyLooksGrounded(params: {
  generatedCore: string
  thread: GmailThread
  threadContext?: GmailThreadContext | null
  latestInbound?: { bodyPreview?: string; bodyText?: string; snippet?: string } | null
}) {
  const contextText = buildGroundingContextText(params)
  const contextTokens = tokenizeRelevantWords(contextText)
  if (contextTokens.length === 0) return true

  const contextTokenSet = new Set(contextTokens)
  const generatedTokens = tokenizeRelevantWords(params.generatedCore)
  if (generatedTokens.length === 0) return false

  const overlapCount = generatedTokens.filter((token) => contextTokenSet.has(token)).length
  const overlapRatio = overlapCount / generatedTokens.length
  const openingSentence = params.generatedCore
    .split(/[.!?](?:\s|$)/)
    .map((sentence) => sentence.trim())
    .find(Boolean) ?? ""
  const openingTokens = tokenizeRelevantWords(openingSentence)
  const openingOverlap = openingTokens.filter((token) => contextTokenSet.has(token)).length
  const unsupportedTokens = generatedTokens.filter(
    (token) => !contextTokenSet.has(token) && !GENERIC_REPLY_TOKENS.has(token)
  )

  if (openingTokens.length > 0 && openingOverlap === 0) {
    return false
  }

  if (unsupportedTokens.length >= 8 && overlapRatio < 0.35) {
    return false
  }

  return overlapCount >= Math.min(2, contextTokens.length) && overlapRatio >= 0.18
}

function buildDraftBody(
  thread: GmailThread,
  displayName: string,
  settings: RelayCustomizationSettings,
  styleProfile: EmailStyleProfile,
  threadContext?: GmailThreadContext | null,
  userEmail?: string | null
) {
  const replyIdentity = deriveReplyIdentity({
    thread,
    threadContext,
    userEmail,
    displayName,
  })
  const coreBody = buildDraftCoreBody(thread, settings, styleProfile, threadContext, userEmail)

  return assembleDraftBody({
    coreBody,
    recipientName: replyIdentity.recipientName,
    displayName,
    settings,
    styleProfile,
  })
}

function buildDraftGenerationMetadata(params: {
  source: "openai" | "deterministic_fallback"
  finalDraftSource: "openai_fresh_generation" | "cached_generated_draft" | "deterministic_fallback"
  model?: string
  styleProfile: EmailStyleProfile
  openAIConfigured: boolean
  attemptedOpenAI: boolean
  fallbackReason?: string
  hasOriginalThreadContext: boolean
  cacheStatus?: "generated" | "cached" | "regenerated"
  debug?: NonNullable<NonNullable<PendingAction["personalization"]>["generation"]>["debug"]
}) {
  const usedSentMailStyle = params.styleProfile.source === "sent_mail"
  return {
    source: params.source,
    finalDraftSource: params.finalDraftSource,
    cacheStatus: params.cacheStatus,
    generatedAt: new Date().toISOString(),
    model: params.model,
    openAIConfigured: params.openAIConfigured,
    attemptedOpenAI: params.attemptedOpenAI,
    usedOriginalThreadContext: params.hasOriginalThreadContext,
    usedSentMailStyle,
    usedSavedSettings: true,
    styleSampleCount: params.styleProfile.sampleCount,
    fallbackReason: params.fallbackReason,
    debug: params.debug,
    note:
      params.source === "openai"
        ? `OpenAI drafted this reply using ${usedSentMailStyle ? "sent-mail style" : "fallback style"} and saved settings.`
        : `Deterministic fallback drafted this reply${params.fallbackReason ? ` because ${params.fallbackReason}` : ""}.`,
  } satisfies NonNullable<PendingAction["personalization"]>["generation"]
}

function buildEmailWhySurfaced(thread: GmailThread, score: number) {
  const reasons = []
  if (thread.isUnread) reasons.push("it is unread")
  if (score >= 4) reasons.push("the subject/snippet looks time-sensitive")
  if (/\?/.test(`${thread.subject} ${thread.snippet}`)) reasons.push("it appears to need a reply")

  if (reasons.length === 0) {
    reasons.push("it is a recent inbox thread that looks reply-worthy")
  }

  return `Live Gmail heuristic surfaced this thread because ${reasons.join(", ")}.`
}

function isStrongReplyCandidate(thread: GmailThread, score: number) {
  const text = `${thread.subject} ${thread.snippet}`.toLowerCase()
  if (thread.isUnread && score >= 5) return true
  if (score >= 8) return true
  if (/(approve|approval|confirm|deadline|asap|urgent|question|\?)/.test(text)) return true
  return false
}

async function deriveLiveDraftEmailActions(
  sessionEmail: string,
  threads: GmailThread[],
  displayName: string,
  settings: RelayCustomizationSettings,
  styleProfile: EmailStyleProfile,
  cachedDrafts: Awaited<ReturnType<typeof listGeneratedDraftsForUser>>
): Promise<PendingActionBase[]> {
  const candidates: Array<{
    thread: GmailThread
    heuristicScore: number
    urgency: PendingAction["urgency"]
    action: PendingActionBase
    isStrongCandidate: boolean
  }> = []

  for (const thread of threads) {
    const to = parseEmailAddress(thread.from)
    const score = getThreadCandidateScore(thread)
    const urgency = getEmailUrgency(score, thread)
    if (!to || isLikelyAutomatedAddress(to)) {
      continue
    }

    candidates.push({
      thread,
      heuristicScore: score,
      urgency,
      action: {
        id: `${LIVE_EMAIL_ACTION_PREFIX}${thread.id}`,
        type: "draft_email" as const,
        title: `Draft reply to ${thread.subject}`,
        sourceContext: `${thread.subject} - from ${thread.from}`,
        provenance: {
          provider: "gmail",
          sourceType: "gmail_thread",
          origin: "live",
          sourceIdentifiers: {
            gmailThreadId: thread.id,
            gmailMessageId: thread.messageId,
          },
        },
        proposedAction: {
          to,
          subject: normalizeReplySubject(thread.subject),
          body: buildDraftBody(thread, displayName, settings, styleProfile, null, sessionEmail),
          threadId: thread.id,
        },
        urgency,
        whySurfaced: buildEmailWhySurfaced(thread, score),
        personalization: {
          styleSource: styleProfile.source,
          settingsApplied: true,
          summary: buildPersonalizationSummary(settings, styleProfile),
          styleDebug: {
            sampleCount: styleProfile.sampleCount,
            usesEmDash: styleProfile.usesEmDash,
            usesBullets: styleProfile.usesBullets,
            signatureUsage: styleProfile.signatureUsage,
            greetingStyle: styleProfile.greetingStyle,
            signOffStyle: styleProfile.signOffStyle,
          },
        },
        createdAt: thread.date,
      } satisfies PendingActionBase,
      isStrongCandidate: isStrongReplyCandidate(thread, score),
    })
  }

  candidates.sort((left, right) => {
    const urgencyRank = { urgent: 3, important: 2, low: 1 }
    const urgencyDelta = urgencyRank[right.action.urgency] - urgencyRank[left.action.urgency]
    if (urgencyDelta !== 0) return urgencyDelta
    return new Date(right.action.createdAt).getTime() - new Date(left.action.createdAt).getTime()
  })

  const selectedCandidates =
    candidates.length > 0
      ? candidates.slice(0, MAX_SELECTED_EMAIL_ACTIONS)
      : candidates.slice(0, 1).map((candidate) => ({
          ...candidate,
          action: {
            ...candidate.action,
            urgency: candidate.action.urgency === "low" ? "important" : candidate.action.urgency,
            whySurfaced:
              "Live Gmail fallback surfaced a recent reply-worthy thread from the broader inbox window.",
          },
        }))

  return await Promise.all(
    selectedCandidates.slice(0, MAX_SELECTED_EMAIL_ACTIONS).map(async (candidate) => {
      const proposedAction = candidate.action.proposedAction as DraftEmailPayload
      const threadContext = normalizeThreadContextForDrafting(
        await getGmailThreadContext(sessionEmail, candidate.thread.id).catch(() => null)
      )
      const cacheKey = buildDraftCacheKey({
        threadId: candidate.thread.id,
        latestMessageId: candidate.thread.messageId ?? threadContext?.messages.at(-1)?.id,
        activeThreadText: buildActiveThreadText(candidate.thread, threadContext),
        settings,
        styleProfile,
      })
      const cachedDraft = cachedDrafts[candidate.action.id]
      const reusableCachedDraft =
        cachedDraft &&
        cachedDraft.cacheKey === cacheKey &&
        (cachedDraft.generation.source === "openai" || !hasOpenAIReasoning())
          ? cachedDraft
          : undefined
      const cachedGeneration =
        reusableCachedDraft
          ? {
              ...reusableCachedDraft.generation,
              finalDraftSource: "cached_generated_draft" as const,
              cacheStatus: "cached" as const,
            }
          : undefined

      return {
        ...candidate.action,
        personalization: {
          styleSource: candidate.action.personalization?.styleSource ?? styleProfile.source,
          settingsApplied: candidate.action.personalization?.settingsApplied ?? true,
          summary:
            candidate.action.personalization?.summary ?? buildPersonalizationSummary(settings, styleProfile),
          styleDebug: candidate.action.personalization?.styleDebug ?? {
            sampleCount: styleProfile.sampleCount,
            usesEmDash: styleProfile.usesEmDash,
            usesBullets: styleProfile.usesBullets,
            signatureUsage: styleProfile.signatureUsage,
            greetingStyle: styleProfile.greetingStyle,
            signOffStyle: styleProfile.signOffStyle,
          },
          generation: cachedGeneration,
        },
        originalContext: threadContext ? buildEmailOriginalContext(threadContext) : candidate.action.originalContext,
        proposedAction: {
          ...proposedAction,
          body: reusableCachedDraft ? reusableCachedDraft.body : "",
        },
      }
    })
  )
}

function overlaps(left: { start: string; end: string }, right: { start: string; end: string }) {
  return new Date(left.start).getTime() < new Date(right.end).getTime() &&
    new Date(right.start).getTime() < new Date(left.end).getTime()
}

function findNextAvailableSlot(target: CalendarEvent, events: CalendarEvent[], earliestStart: number) {
  const durationMs =
    new Date(target.end).getTime() - new Date(target.start).getTime()
  if (durationMs <= 0) return null

  const sorted = [...events]
    .filter((event) => !event.isAllDay)
    .sort((left, right) => new Date(left.start).getTime() - new Date(right.start).getTime())

  let candidateStart = earliestStart
  let candidateEnd = candidateStart + durationMs

  for (const event of sorted) {
    if (event.id === target.id) continue

    const eventStart = new Date(event.start).getTime()
    const eventEnd = new Date(event.end).getTime()
    if (eventEnd <= candidateStart) continue

    if (eventStart < candidateEnd && candidateStart < eventEnd) {
      candidateStart = eventEnd
      candidateEnd = candidateStart + durationMs
    }
  }

  const dayBoundary = new Date(target.start)
  dayBoundary.setHours(23, 59, 59, 999)
  if (candidateEnd > dayBoundary.getTime()) {
    return null
  }

  return {
    proposedStart: new Date(candidateStart).toISOString(),
    proposedEnd: new Date(candidateEnd).toISOString(),
  }
}

function chooseEventToMove(left: CalendarEvent, right: CalendarEvent) {
  if (isGoogleMeetEvent(left) && !isGoogleMeetEvent(right)) {
    return { eventToMove: right, blockingEvent: left }
  }
  if (isGoogleMeetEvent(right) && !isGoogleMeetEvent(left)) {
    return { eventToMove: left, blockingEvent: right }
  }

  const leftStart = new Date(left.start).getTime()
  const rightStart = new Date(right.start).getTime()
  return leftStart <= rightStart
    ? { eventToMove: right, blockingEvent: left }
    : { eventToMove: left, blockingEvent: right }
}

function deriveLiveRescheduleActions(events: CalendarEvent[]): PendingActionBase[] {
  const sorted = [...events]
    .filter((event) => !event.isAllDay && new Date(event.end).getTime() >= Date.now())
    .sort((left, right) => new Date(left.start).getTime() - new Date(right.start).getTime())

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index]
    const next = sorted[index + 1]
    if (!current || !next || !overlaps(current, next)) continue

    const { eventToMove, blockingEvent } = chooseEventToMove(current, next)
    const slot = findNextAvailableSlot(
      eventToMove,
      sorted,
      Math.max(new Date(eventToMove.start).getTime(), new Date(blockingEvent.end).getTime())
    )

    if (!slot) continue

    return [
      {
        id: `${LIVE_CALENDAR_ACTION_PREFIX}${eventToMove.id}`,
        type: "reschedule_meeting",
        title: `Reschedule ${eventToMove.title}`,
        sourceContext: `${eventToMove.title} overlaps with ${blockingEvent.title}`,
        provenance: {
          provider: "google_calendar",
          sourceType: "calendar_event",
          origin: "live",
          sourceIdentifiers: parseCalendarSourceIdentifiers(eventToMove.id),
        },
        proposedAction: {
          eventId: eventToMove.id,
          eventTitle: eventToMove.title,
          currentStart: eventToMove.start,
          currentEnd: eventToMove.end,
          proposedStart: slot.proposedStart,
          proposedEnd: slot.proposedEnd,
        },
        originalContext: {
          kind: "calendar_event" as const,
          preview: `${eventToMove.title} currently runs ${new Date(eventToMove.start).toLocaleTimeString(
            "en-US",
            {
              hour: "numeric",
              minute: "2-digit",
            }
          )} to ${new Date(eventToMove.end).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })}.`,
          title: eventToMove.title,
          currentStart: eventToMove.start,
          currentEnd: eventToMove.end,
          location: eventToMove.location,
          joinUrl: eventToMove.joinUrl,
        },
        urgency: "urgent",
        whySurfaced: `Live Calendar conflict detection found a real overlap with ${blockingEvent.title}.`,
        createdAt: eventToMove.start,
      } satisfies PendingActionBase,
    ]
  }

  return []
}

function hydrateActions(actions: PendingActionBase[], source: ActionsViewState["source"]) {
  const normalizedActions = actions.map(withNormalizedProvenance)
  rememberActionBases(normalizedActions)
  const merged = normalizedActions
    .map(mergeActionWithStore)
    .filter((a) => a.status !== "rejected")

  if (source !== "google") {
    return merged
  }

  const seen = new Set(normalizedActions.map((action) => action.id))
  const carried = getStoredActions()
    .map(withNormalizedProvenance)
    .filter((action) => action.provenance.origin === "live" && !seen.has(action.id))
    .map(mergeActionWithStore)
    .filter((action) => action.status === "approved")

  return [...merged, ...carried].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  )
}

function buildMockActionResult(statusNote: string) {
  return {
    actions: hydrateActions(seededActions, "mock"),
    viewState: {
      source: "mock" as const,
      statusNote,
    },
  }
}

async function deriveActionsData() {
  const session = await getOptionalSession()
  const googleStatus = await getBaseGoogleIntegrationStatus({
    email: session?.user?.email,
    name: session?.user?.name,
    hasSession: Boolean(session?.user?.email),
  })

  if (!googleStatus.canUseLiveBriefing || !session?.user?.email) {
    return buildMockActionResult(googleStatus.note)
  }

  try {
    const displayName = session.user.name ?? googleStatus.displayName ?? DEMO_SIGNATURE_NAME
    const { settings, styleProfile } = await getRelayPersonalization({
      email: session.user.email,
      displayName,
    })
    const cachedDrafts = await listGeneratedDraftsForUser(session.user.email)
    const [threads, rawEvents] = await Promise.all([
      getLiveGmailThreads(session.user.email, LIVE_ACTION_THREAD_LIMIT),
      getLiveCalendarEvents(session.user.email),
    ])
    const events = getConflictingEvents(rawEvents)
    const liveActions = [
      ...(await deriveLiveDraftEmailActions(
        session.user.email,
        threads,
        displayName,
        settings,
        styleProfile,
        cachedDrafts
      )),
      ...deriveLiveRescheduleActions(events),
    ]

    if (liveActions.length === 0) {
      return buildMockActionResult(
        "Relay could not derive a live Gmail reply or Calendar reschedule from the current Google data, so it is showing explicit demo fallback actions."
      )
    }

    return {
      actions: hydrateActions(liveActions, "google"),
      viewState: {
        source: "google" as const,
        statusNote: hasOpenAIReasoning()
          ? "Live Gmail and Calendar data are active. Email replies are generated on demand and reused from cache when nothing material changed."
          : "Live Gmail and Calendar data are active, but email drafts are currently using deterministic fallback because OPENAI_API_KEY is not configured in the current server runtime.",
      },
    }
  } catch (error) {
    return buildMockActionResult(
      error instanceof Error
        ? `Live Google action sourcing failed, so Relay fell back to explicit demo actions: ${error.message}`
        : "Live Google action sourcing failed, so Relay fell back to explicit demo actions."
    )
  }
}

async function getActionBaseById(id: string): Promise<PendingActionBase | null> {
  const stored = getStoredActionById(id)
  if (stored) return withNormalizedProvenance(stored)

  await deriveActionsData()
  const hydrated = getStoredActionById(id)
  return hydrated ? withNormalizedProvenance(hydrated) : null
}

async function generateDraftForActionWithIdentity(params: {
  id: string
  userEmail: string
  displayName?: string | null
  options?: { force?: boolean }
}) {
  const base = await getActionBaseById(params.id)
  if (!base) return null

  const displayName = params.displayName ?? DEMO_SIGNATURE_NAME
  const provenance = inferActionProvenance(base)

  if (provenance.provider !== "gmail" || provenance.origin !== "live") {
    return mergeActionWithStore(base)
  }

  const id = params.id
  const userEmail = params.userEmail

  const threadId = provenance.sourceIdentifiers?.gmailThreadId ?? (base.proposedAction as DraftEmailPayload).threadId
  if (!threadId) {
    throw new Error("No Gmail thread is linked to this action")
  }

  const [thread, threadContext, { settings, styleProfile }, cachedDrafts] = await Promise.all([
    getLiveGmailThreadById(userEmail, threadId),
    getGmailThreadContext(userEmail, threadId),
    getRelayPersonalization({
      email: userEmail,
      displayName,
    }),
    listGeneratedDraftsForUser(userEmail),
  ])

  if (!thread) {
    throw new Error("The Gmail thread could not be loaded for this action")
  }

  const normalizedThreadContext = normalizeThreadContextForDrafting(threadContext)
  const latestMessageId = thread.messageId ?? normalizedThreadContext?.messages.at(-1)?.id
  const activeThreadText = buildActiveThreadText(thread, normalizedThreadContext)

  const cacheKey = buildDraftCacheKey({
    threadId,
    latestMessageId,
    activeThreadText,
    settings,
    styleProfile,
  })
  const cachedDraft = cachedDrafts[id]
  const replyIdentity = deriveReplyIdentity({
    thread,
    threadContext: normalizedThreadContext,
    userEmail,
    displayName,
  })
  const openAIConfigured = hasOpenAIReasoning()
  const debugEnabled = shouldDebugDraftAction(id)
  const buildDebugMetadata = (params: {
    usedCachedDraft: boolean
    cachedDraftSource?: "openai" | "deterministic_fallback"
    openAISucceeded: boolean
    openAIError?: string
    openAIDraftPreview?: string
    groundingAccepted?: boolean
    fallbackTriggered: boolean
    fallbackReason?: string
    finalDraftSource: "openai_fresh_generation" | "cached_generated_draft" | "deterministic_fallback"
  }) =>
    debugEnabled
      ? {
          actionId: id,
          threadId,
          latestMessageId,
          activeThreadText,
          cacheKey,
          cacheVersion: GENERATED_DRAFT_CACHE_VERSION,
          cachedDraftSource: params.cachedDraftSource,
          usedCachedDraft: params.usedCachedDraft,
          openAISucceeded: params.openAISucceeded,
          openAIError: params.openAIError,
          openAIDraftPreview: params.openAIDraftPreview,
          groundingAccepted: params.groundingAccepted,
          fallbackTriggered: params.fallbackTriggered,
          fallbackReason: params.fallbackReason,
          finalDraftSource: params.finalDraftSource,
        }
      : undefined
  const reusableCachedDraft =
    !params.options?.force &&
    cachedDraft &&
    cachedDraft.cacheKey === cacheKey &&
    (cachedDraft.generation.source === "openai" || !openAIConfigured)
      ? cachedDraft
      : null

  logDraftDebug(id, "pipeline_context", {
    threadId,
    latestMessageId,
    activeThreadText,
    cacheKey,
    cacheVersion: GENERATED_DRAFT_CACHE_VERSION,
    cachedDraftFound: Boolean(cachedDraft),
    reusableCachedDraft: Boolean(reusableCachedDraft),
    settingsLoaded: true,
    styleSource: styleProfile.source,
    styleSampleCount: styleProfile.sampleCount,
  })

  if (reusableCachedDraft) {
    logDraftDebug(id, "cache_hit", {
      finalDraftSource: "cached_generated_draft",
      fallbackTriggered: reusableCachedDraft.generation.source !== "openai",
      fallbackReason: reusableCachedDraft.generation.fallbackReason,
    })
    const updatedBase: PendingActionBase = {
      ...base,
      provenance: {
        ...base.provenance,
        sourceIdentifiers: {
          ...base.provenance.sourceIdentifiers,
          gmailMessageId: thread.messageId,
          gmailRfcMessageId: normalizedThreadContext?.replyToMessageId,
          gmailReferenceMessageIds: normalizedThreadContext?.referenceMessageIds,
        },
      },
      personalization: {
        styleSource: base.personalization?.styleSource ?? styleProfile.source,
        settingsApplied: base.personalization?.settingsApplied ?? true,
        summary: base.personalization?.summary ?? buildPersonalizationSummary(settings, styleProfile),
        styleDebug: base.personalization?.styleDebug ?? {
          sampleCount: styleProfile.sampleCount,
          usesEmDash: styleProfile.usesEmDash,
          usesBullets: styleProfile.usesBullets,
          signatureUsage: styleProfile.signatureUsage,
          greetingStyle: styleProfile.greetingStyle,
          signOffStyle: styleProfile.signOffStyle,
        },
        generation: {
          ...reusableCachedDraft.generation,
          finalDraftSource: "cached_generated_draft",
          cacheStatus: "cached",
          debug: buildDebugMetadata({
            usedCachedDraft: true,
            cachedDraftSource: reusableCachedDraft.generation.source,
            openAISucceeded: reusableCachedDraft.generation.source === "openai",
            fallbackTriggered: reusableCachedDraft.generation.source !== "openai",
            openAIError: reusableCachedDraft.generation.fallbackReason,
            groundingAccepted: reusableCachedDraft.generation.source === "openai",
            fallbackReason: reusableCachedDraft.generation.fallbackReason,
            finalDraftSource: "cached_generated_draft",
          }),
        },
      },
      originalContext: buildEmailOriginalContext(normalizedThreadContext),
      proposedAction: {
        ...(base.proposedAction as DraftEmailPayload),
        to:
          replyIdentity.recipientEmail ??
          parseEmailAddress(thread.from) ??
          (base.proposedAction as DraftEmailPayload).to,
        subject: normalizeReplySubject(thread.subject),
        threadId,
        body: reusableCachedDraft.body,
        replyToMessageId: normalizedThreadContext?.replyToMessageId,
        referenceMessageIds: normalizedThreadContext?.referenceMessageIds,
      },
      createdAt: thread.date,
      sourceContext: `${thread.subject} - from ${thread.from}`,
      title: `Draft reply to ${thread.subject}`,
    }

    rememberActionBases([updatedBase])
    return mergeActionWithStore(updatedBase)
  }

  const deterministicCore = buildDraftCoreBody(
    thread,
    settings,
    styleProfile,
    normalizedThreadContext,
    userEmail
  )
  const deterministicBody = assembleDraftBody({
    coreBody: deterministicCore,
    recipientName: replyIdentity.recipientName,
    displayName,
    settings,
    styleProfile,
  })
  const generatedDraft = await generateDraftEmailBody({
    displayName,
    userEmail,
    recipientName: replyIdentity.recipientName,
    recipientEmail: replyIdentity.recipientEmail,
    thread,
    threadContext: normalizedThreadContext,
    styleProfile,
    settings,
    debug: debugEnabled
      ? {
          onRequest: (payload) =>
            logDraftDebug(id, "openai_request", {
              payload,
            }),
          onResponse: (payload) =>
            logDraftDebug(id, "openai_response", {
              payload,
            }),
        }
      : undefined,
  })
  const generatedCore = generatedDraft?.body ? stripGeneratedReplyFraming(generatedDraft.body) : ""
  const fallbackReason =
    openAIConfigured
      ? generatedDraft?.errorMessage
        ? generatedDraft.errorMessage
        : generatedCore
        ? "the OpenAI draft drifted from the active thread context"
        : "the OpenAI draft request failed"
      : "OPENAI_API_KEY is not configured in the current server runtime"
  const useGeneratedCore = Boolean(
    generatedCore &&
    generatedBodyLooksGrounded({
      generatedCore,
      thread,
      threadContext: normalizedThreadContext,
      latestInbound: replyIdentity.latestInbound,
    })
  )
  logDraftDebug(id, "generation_decision", {
    generatedCore,
    useGeneratedCore,
    fallbackReason: useGeneratedCore ? undefined : fallbackReason,
  })
  const body = useGeneratedCore
    ? assembleDraftBody({
        coreBody: generatedCore,
        recipientName: replyIdentity.recipientName,
        displayName,
        settings,
        styleProfile,
      })
    : deterministicBody
  const generation = generatedDraft && useGeneratedCore
    ? buildDraftGenerationMetadata({
        source: "openai",
        finalDraftSource: "openai_fresh_generation",
        model: generatedDraft.model,
        styleProfile,
        openAIConfigured,
        attemptedOpenAI: true,
        hasOriginalThreadContext: Boolean(normalizedThreadContext),
        cacheStatus: params.options?.force ? "regenerated" : "generated",
        debug: buildDebugMetadata({
          usedCachedDraft: false,
          cachedDraftSource: undefined,
          openAISucceeded: true,
          openAIDraftPreview: generatedCore,
          groundingAccepted: true,
          fallbackTriggered: false,
          finalDraftSource: "openai_fresh_generation",
        }),
      })
    : buildDraftGenerationMetadata({
        source: "deterministic_fallback",
        finalDraftSource: "deterministic_fallback",
        styleProfile,
        openAIConfigured,
        attemptedOpenAI: openAIConfigured,
        hasOriginalThreadContext: Boolean(normalizedThreadContext),
        fallbackReason,
        cacheStatus: params.options?.force ? "regenerated" : "generated",
        debug: buildDebugMetadata({
          usedCachedDraft: false,
          cachedDraftSource: undefined,
          openAISucceeded: false,
          openAIError: generatedDraft?.errorMessage,
          openAIDraftPreview: generatedCore || (generatedDraft?.body ?? undefined),
          groundingAccepted: false,
          fallbackTriggered: true,
          fallbackReason,
          finalDraftSource: "deterministic_fallback",
        }),
      })

  await saveGeneratedDraft({
    actionId: id,
    userEmail,
    threadId,
    cacheKey,
    body,
    generation,
    updatedAt: new Date().toISOString(),
  })
  logDraftDebug(id, "draft_persisted", {
    finalDraftSource: generation.finalDraftSource,
    fallbackTriggered: generation.source === "deterministic_fallback",
    fallbackReason: generation.fallbackReason,
  })

  const updatedBase: PendingActionBase = {
    ...base,
    provenance: {
      ...base.provenance,
      sourceIdentifiers: {
        ...base.provenance.sourceIdentifiers,
        gmailMessageId: thread.messageId,
        gmailRfcMessageId: normalizedThreadContext?.replyToMessageId,
        gmailReferenceMessageIds: normalizedThreadContext?.referenceMessageIds,
      },
    },
    personalization: {
        styleSource: base.personalization?.styleSource ?? styleProfile.source,
        settingsApplied: base.personalization?.settingsApplied ?? true,
        summary: base.personalization?.summary ?? buildPersonalizationSummary(settings, styleProfile),
        styleDebug: base.personalization?.styleDebug ?? {
          sampleCount: styleProfile.sampleCount,
          usesEmDash: styleProfile.usesEmDash,
          usesBullets: styleProfile.usesBullets,
          signatureUsage: styleProfile.signatureUsage,
          greetingStyle: styleProfile.greetingStyle,
          signOffStyle: styleProfile.signOffStyle,
        },
        generation,
    },
    originalContext: buildEmailOriginalContext(normalizedThreadContext),
    proposedAction: {
      ...(base.proposedAction as DraftEmailPayload),
      to:
        replyIdentity.recipientEmail ??
        parseEmailAddress(thread.from) ??
        (base.proposedAction as DraftEmailPayload).to,
      subject: normalizeReplySubject(thread.subject),
      threadId,
      body,
      replyToMessageId: normalizedThreadContext?.replyToMessageId,
      referenceMessageIds: normalizedThreadContext?.referenceMessageIds,
    },
    createdAt: thread.date,
    sourceContext: `${thread.subject} - from ${thread.from}`,
    title: `Draft reply to ${thread.subject}`,
  }

  rememberActionBases([updatedBase])
  return mergeActionWithStore(updatedBase)
}

/** Replaces demo name in email bodies with the given display name (for personalized display when user is connected). */
export function substituteDisplayNameInActions(
  actions: PendingAction[],
  displayName: string
): PendingAction[] {
  if (!displayName || displayName === DEMO_SIGNATURE_NAME) return actions
  return actions.map((action) => {
    const out = { ...action }
    if (action.proposedAction && "body" in action.proposedAction) {
      out.proposedAction = {
        ...action.proposedAction,
        body: (action.proposedAction as DraftEmailPayload).body.replaceAll(
          DEMO_SIGNATURE_NAME,
          displayName
        ),
      }
    }
    if (out.reviewedContent && "body" in out.reviewedContent) {
      out.reviewedContent = {
        ...out.reviewedContent,
        body: (out.reviewedContent as DraftEmailPayload).body.replaceAll(
          DEMO_SIGNATURE_NAME,
          displayName
        ),
      }
    }
    return out
  })
}

export async function listActions(): Promise<{
  actions: PendingAction[]
  viewState: ActionsViewState
}> {
  return await deriveActionsData()
}

export async function generateDraftForAction(
  id: string,
  options?: { force?: boolean }
): Promise<PendingAction | null> {
  const session = await getOptionalSession()
  const userEmail = session?.user?.email ?? null
  if (!userEmail) {
    const base = await getActionBaseById(id)
    return base ? mergeActionWithStore(base) : null
  }

  return generateDraftForActionWithIdentity({
    id,
    userEmail,
    displayName: session?.user?.name,
    options,
  })
}

export async function generateDraftForActionAsUser(params: {
  id: string
  userEmail: string
  displayName?: string | null
  force?: boolean
}) {
  return generateDraftForActionWithIdentity({
    id: params.id,
    userEmail: params.userEmail,
    displayName: params.displayName,
    options: { force: params.force },
  })
}

export async function updateActionContent(
  id: string,
  content: ReviewedContent
): Promise<PendingAction | null> {
  const base = await getActionBaseById(id)
  if (!base) return null

  const mergedBase = mergeActionWithStore(base)
  if (mergedBase.status === "approved" || mergedBase.status === "rejected") {
    throw new Error("Cannot edit approved or rejected action")
  }

  const normalizedContent =
    isDraftEmailPayload(content) &&
    base.provenance.provider === "gmail" &&
    base.provenance.origin === "live" &&
    base.personalization?.styleDebug?.usesEmDash === false
      ? {
          ...content,
          body: normalizeDraftEmDashPreference(content.body, false),
        }
      : content

  setActionEditedContent(id, base, normalizedContent)
  return mergeActionWithStore(base)
}

function isDraftEmailPayload(
  p: DraftEmailPayload | RescheduleMeetingPayload
): p is DraftEmailPayload {
  return "subject" in p && "body" in p
}

function isReschedulePayload(
  p: DraftEmailPayload | RescheduleMeetingPayload
): p is RescheduleMeetingPayload {
  return "eventId" in p && "proposedStart" in p && "proposedEnd" in p
}

function buildExecutionSummary(
  provenance: ActionProvenance,
  content: DraftEmailPayload | RescheduleMeetingPayload
) {
  if (provenance.origin === "mock") {
    if (isDraftEmailPayload(content)) {
      return `Demo approval recorded for draft to ${content.to ?? "recipient"}`
    }

    if (isReschedulePayload(content)) {
      return `Demo approval recorded for reschedule of ${content.eventTitle}`
    }

    return "Demo approval recorded"
  }

  if (provenance.provider === "gmail" && isDraftEmailPayload(content)) {
    return `Live Gmail reply sent to ${content.to ?? "recipient"}`
  }

  if (provenance.provider === "google_calendar" && isReschedulePayload(content)) {
    return `${content.eventTitle} rescheduled in Google Calendar`
  }

  return "Action executed"
}

export async function approveAction(
  id: string,
  content?: ReviewedContent
): Promise<PendingAction | null> {
  const base = await getActionBaseById(id)
  if (!base) return null

  const mergedBase = mergeActionWithStore(base)
  if (mergedBase.status === "approved") {
    throw new Error("Action already approved")
  }
  if (mergedBase.status === "rejected") {
    throw new Error("Cannot approve rejected action")
  }

  const rawContentToExecute = content ?? mergedBase.reviewedContent ?? base.proposedAction
  const session = await getOptionalSession()
  const userEmail = session?.user?.email ?? null
  const provenance = inferActionProvenance(base)
  const contentToExecute =
    isDraftEmailPayload(rawContentToExecute) &&
    provenance.provider === "gmail" &&
    provenance.origin === "live" &&
    base.personalization?.styleDebug?.usesEmDash === false
      ? {
          ...rawContentToExecute,
          body: normalizeDraftEmDashPreference(rawContentToExecute.body, false),
        }
      : rawContentToExecute
  const shouldExecuteLive = Boolean(userEmail && canExecuteLive(provenance.origin, provenance.provider))
  if (provenance.provider === "gmail" && isDraftEmailPayload(contentToExecute) && !contentToExecute.body.trim()) {
    throw new Error("Generate a reply before approving this email action")
  }
  const executionSummary = buildExecutionSummary(provenance, contentToExecute)

  const record: Omit<ActionExecutionRecord, "id" | "executedAt" | "status" | "errorMessage"> = {
    actionId: id,
    type: base.type as ActionType,
    title: base.title,
    sourceContext: base.sourceContext,
    proposedPayload: contentToExecute,
    executionSummary,
    userEmail,
    source: provenance.origin,
    provider: provenance.provider,
    sourceType: provenance.sourceType,
    sourceIdentifiers: provenance.sourceIdentifiers,
  }

  if (shouldExecuteLive && provenance.provider === "gmail" && isDraftEmailPayload(contentToExecute)) {
    try {
      await sendEmail(userEmail, {
        to: contentToExecute.to,
        subject: contentToExecute.subject,
        body: contentToExecute.body,
        threadId: contentToExecute.threadId,
        replyToMessageId: contentToExecute.replyToMessageId,
        referenceMessageIds: contentToExecute.referenceMessageIds,
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Gmail send failed"
      await appendActionExecution({
        ...record,
        id: crypto.randomUUID(),
        executedAt: new Date().toISOString(),
        status: "failed",
        errorMessage,
      })
      throw new Error(`Send failed: ${errorMessage}`)
    }
  } else if (shouldExecuteLive && provenance.provider === "google_calendar" && isReschedulePayload(contentToExecute)) {
    try {
      await patchCalendarEvent(
        userEmail,
        contentToExecute.eventId,
        contentToExecute.proposedStart,
        contentToExecute.proposedEnd
      )
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Calendar patch failed"
      await appendActionExecution({
        ...record,
        id: crypto.randomUUID(),
        executedAt: new Date().toISOString(),
        status: "failed",
        errorMessage,
      })
      throw new Error(`Reschedule failed: ${errorMessage}`)
    }
  }

  const { executedAt, executionSummary: storedExecutionSummary } = setActionApproved(
    id,
    base,
    contentToExecute,
    executionSummary
  )
  await appendActionExecution({
    ...record,
    id: crypto.randomUUID(),
    executedAt,
    status: "success",
  })
  const updated = mergeActionWithStore(base)
  return {
    ...updated,
    executedAt,
    executionSummary: storedExecutionSummary,
  }
}

export async function rejectAction(id: string): Promise<PendingAction | null> {
  const base = await getActionBaseById(id)
  if (!base) return null

  const mergedBase = mergeActionWithStore(base)
  if (mergedBase.status === "approved") {
    throw new Error("Cannot reject approved action")
  }
  if (mergedBase.status === "rejected") {
    throw new Error("Action already rejected")
  }

  const session = await getOptionalSession()
  const provenance = inferActionProvenance(base)
  const contentToRecord = mergedBase.reviewedContent ?? base.proposedAction
  setActionRejected(id, base)
  await appendActionExecution({
    id: crypto.randomUUID(),
    actionId: id,
    type: base.type as ActionType,
    title: base.title,
    sourceContext: base.sourceContext,
    proposedPayload: contentToRecord,
    executionSummary: "Rejected during review. No Gmail send or Calendar change was executed.",
    executedAt: new Date().toISOString(),
    status: "rejected",
    userEmail: session?.user?.email ?? null,
    source: provenance.origin,
    provider: provenance.provider,
    sourceType: provenance.sourceType,
    sourceIdentifiers: provenance.sourceIdentifiers,
  })
  return mergeActionWithStore(base)
}
