import type {
  EmailStyleProfile,
  GmailThread,
  GmailThreadContext,
  PendingAction,
  RelayCustomizationSettings,
} from "@/types"

function parseEmailAddress(value?: string | null) {
  if (!value) return undefined
  const bracketMatch = value.match(/<([^>]+)>/)
  if (bracketMatch?.[1]) return bracketMatch[1].trim().toLowerCase()

  const emailMatch = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return emailMatch?.[0]?.trim().toLowerCase()
}

function formatThreadAge(date: string) {
  const deltaMs = Date.now() - new Date(date).getTime()
  const hours = Math.max(0, Math.round(deltaMs / (1000 * 60 * 60)))
  if (hours < 1) return "less than 1 hour ago"
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? "" : "s"} ago`
}

export function buildActionRankingPrompt(params: {
  displayName: string
  candidates: Array<{
    thread: GmailThread
    heuristicScore: number
    urgency: PendingAction["urgency"]
  }>
}) {
  const candidateLines = params.candidates.map(({ thread, heuristicScore, urgency }) =>
    [
      `thread_id: ${thread.id}`,
      `from: ${thread.from}`,
      `subject: ${thread.subject}`,
      `snippet: ${thread.snippet || "(empty snippet)"}`,
      `unread: ${thread.isUnread ? "yes" : "no"}`,
      `received: ${formatThreadAge(thread.date)}`,
      `heuristic_score: ${heuristicScore}`,
      `heuristic_urgency: ${urgency}`,
    ].join("\n")
  )

  return `
Rank Gmail reply candidates for Relay.

Prioritize emails genuinely worth replying to soon. Prefer:
- messages that look urgent, blocking, approval-seeking, or directly ask a question
- recent messages that still matter, not just the single newest email
- human senders over automated notifications

Avoid:
- newsletters, receipts, noreply mail, obvious FYI messages, or low-signal chatter
- flooding the UI with too many weak options
- making up facts beyond the subject/snippet metadata provided

Return JSON only in this exact shape:
{
  "ranked": [
    {
      "threadId": "string",
      "score": 0,
      "urgency": "urgent" | "important" | "low",
      "whySurfaced": "string"
    }
  ]
}

Rules:
- Return at most 3 items.
- Keep the whySurfaced field under 140 characters.
- Score from 0 to 100.
- Do not include any thread IDs that were not provided.
- Prefer a shorter list over weak candidates.

User display name: ${params.displayName}

Candidates:
${candidateLines.join("\n\n---\n\n")}
  `.trim()
}

export function buildDraftEmailPrompt(params: {
  displayName: string
  userEmail: string
  recipientName: string
  recipientEmail?: string
  thread: GmailThread
  threadContext?: GmailThreadContext | null
  styleProfile: EmailStyleProfile
  settings: RelayCustomizationSettings
}) {
  const normalizedUserEmail = parseEmailAddress(params.userEmail) ?? params.userEmail.trim().toLowerCase()
  const latestMessages =
    params.threadContext?.messages
      .slice(-4)
      .map(
        (message, index) =>
          `message_${index + 1}:\nrole: ${
            (parseEmailAddress(message.from) ?? "").toLowerCase() === normalizedUserEmail
              ? "signed_in_user_sent"
              : "external_participant_sent"
          }\nfrom: ${message.from}\nto: ${message.to ?? "(not available)"}\nbody: ${
            message.bodyPreview || message.snippet || "(empty)"
          }`
      )
      .join("\n\n---\n\n") ?? "No expanded thread context was available beyond Gmail metadata."

  const structuralHabits =
    params.styleProfile.structuralHabits.length > 0
      ? params.styleProfile.structuralHabits.map((habit) => `- ${habit}`).join("\n")
      : "- keeps replies concise and straightforward"
  const formattingHabits =
    params.styleProfile.formattingHabits.length > 0
      ? params.styleProfile.formattingHabits.map((habit) => `- ${habit}`).join("\n")
      : "- prefers plain paragraph formatting"
  const commonPhrases =
    params.styleProfile.commonPhrases.length > 0
      ? params.styleProfile.commonPhrases.map((phrase) => `- ${phrase}`).join("\n")
      : "- no strong repeated phrase detected"
  const styleAnchorBlocks = [
    ["Greeting examples", params.styleProfile.styleAnchors.greetingExamples],
    ["Sign-off examples", params.styleProfile.styleAnchors.signOffExamples],
    ["Signature examples", params.styleProfile.styleAnchors.signatureExamples],
    ["Formatting patterns", params.styleProfile.styleAnchors.formattingPatterns],
  ]
    .map(([label, values]) => {
      const typedValues = values as string[]
      const trimmedValues = typedValues.slice(0, 2)
      return `${label}:\n${
        trimmedValues.length > 0
          ? trimmedValues.map((value) => `- ${value}`).join("\n")
          : "- none captured"
      }`
    })
    .join("\n\n")

  return `
You are writing a short, real-sounding email reply draft for Relay.

Goals:
- Write a materially better draft than a generic acknowledgment template.
- Sound like the actual user, not an assistant or customer-support bot.
- Base the style on the user's most recent 5-10 sent emails summarized below.
- Use the original active thread context when present so the reply feels responsive to what was actually said.
- Be concise, but not evasive or robotic.
- If the message suggests urgency, acknowledge it naturally.
- Reflect the user's saved preferences and inferred writing style without copying prior emails verbatim.
- Respect the user's actual writing mechanics, not just general tone.
- The signed-in user is the author of the reply.
- The reply recipient is the external participant shown below, not the signed-in user.
- The inbound thread may greet or sign the external sender's own name; never mirror that identity.
- Older quoted reply history has already been stripped from the message excerpts below. Use only these active-message excerpts as factual grounding.

Do not:
- mention AI, Relay, or internal tooling
- claim work is already done unless clearly implied
- fabricate dates, deliverables, or commitments
- write a bland "thanks, I saw this" note unless the message truly contains no more specific response opportunity
- over-explain or sound legalistic
- copy chunks of prior sent mail verbatim
- do not include any greeting, sign-off, signature block, subject line, or sender name
- do not address the signed-in user as the recipient
- do not sign as the external sender or reuse the external sender's closing
- do not pull in topics that are absent from the active excerpts below, even if they sound plausible from older thread history

Return only the reply body text.
Do not return JSON.
Do not return markdown fences.
Do not include any explanation before or after the draft.

Email metadata:
- thread from header: ${params.thread.from}
- subject: ${params.thread.subject}
- unread: ${params.thread.isUnread ? "yes" : "no"}
- snippet: ${params.thread.snippet || "(empty snippet)"}

Reply identity:
- signed-in user / reply author: ${params.displayName} <${params.userEmail}>
- external recipient / reply target: ${params.recipientName}${
          params.recipientEmail ? ` <${params.recipientEmail}>` : ""
        }

Expanded thread context:
${latestMessages}

Saved user preferences:
- preferred tone: ${params.settings.emailTone}
- preferred formality: ${params.settings.emailFormality}
- preferred conciseness: ${params.settings.emailConciseness}
- include greeting: ${params.settings.includeGreeting ? "yes" : "no"}
- include sign-off: ${params.settings.includeSignOff ? "yes" : "no"}
- include signature: ${params.settings.useSignature ? "yes" : "no"}

Inferred sent-mail style profile:
- style source: ${params.styleProfile.source}
- sampled sent emails: ${params.styleProfile.sampleCount}
- greeting style: ${params.styleProfile.greetingStyle}
- tone: ${params.styleProfile.tone}
- formality: ${params.styleProfile.formality}
- sentence length: ${params.styleProfile.sentenceLength}
- directness: ${params.styleProfile.directness}
- sign-off style: ${params.styleProfile.signOffStyle}
- signature usage: ${params.styleProfile.signatureUsage}
- signature block: ${params.styleProfile.signatureBlock ?? "(none detected)"}
- average sentence length (words): ${params.styleProfile.averageSentenceLengthWords}
- punctuation style: ${params.styleProfile.punctuationStyle}
- capitalization style: ${params.styleProfile.capitalizationStyle}
- uses em dash: ${params.styleProfile.usesEmDash ? "yes" : "no"}
- uses bullets: ${params.styleProfile.usesBullets ? "yes" : "no"}
- common phrases:
${commonPhrases}
- structural habits:
${structuralHabits}
- formatting habits:
${formattingHabits}

Recent sent-mail style anchors:
${styleAnchorBlocks}

Writing instructions:
- Mirror the user's likely cadence and structure.
- Prefer matching the sampled openings, closings, sign-offs, and formatting patterns over inventing a new voice.
- If the sender asked a question, answer or acknowledge the question directly in the first 1-2 sentences.
- If the next step is unclear, write a plausible but bounded response that acknowledges receipt and sets a realistic follow-up.
- Prefer concrete wording over vague filler.
- Keep the reply body to roughly 2-6 sentences unless the context clearly needs less.
- If the style profile indicates formal habits like "Hello", "Thank you for the email", "Please let me know", or "Best regards", prefer those exact patterns over casual alternatives.
- If uses em dash is "no", do not use em dashes anywhere in the reply.
- When em dashes are not part of the user's style, prefer commas, periods, or slightly shorter sentences instead.
- If uses bullets is "no", keep the reply in paragraph form unless the thread clearly requires a list.
- Reuse only supported style signals; do not invent mannerisms that are not present in the inferred profile.
- Return only the reply body content that should appear between the greeting and the sign-off.
  `.trim()
}
