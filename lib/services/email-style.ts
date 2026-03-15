import "server-only"

import { getStore, setStore } from "@/lib/persistence/store-backend"
import { getRelayCustomizationSettings } from "@/lib/persistence/user-preferences"
import { getRecentSentEmailSamples } from "@/lib/services/gmail"
import type {
  CapitalizationStyle,
  DirectnessPreference,
  EmailStyleProfile,
  GreetingStyle,
  PunctuationStyle,
  RelayCustomizationSettings,
  SentEmailSample,
  SignatureUsage,
  SignOffStyle,
  TonePreference,
} from "@/types"

const PROFILE_STALE_MS = 1000 * 60 * 60 * 12
const CURRENT_PROFILE_VERSION = 7

type EmailStyleStore = Record<string, EmailStyleProfile>

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() ?? null
}

function normalizeStoredProfile(profile: Partial<EmailStyleProfile>): EmailStyleProfile {
  return {
    profileVersion:
      typeof profile.profileVersion === "number" ? profile.profileVersion : 1,
    source: profile.source === "sent_mail" ? "sent_mail" : "fallback",
    analyzedAt: profile.analyzedAt ?? new Date(0).toISOString(),
    sampleCount: typeof profile.sampleCount === "number" ? profile.sampleCount : 0,
    sampledEmailSubjects: Array.isArray(profile.sampledEmailSubjects)
      ? profile.sampledEmailSubjects.filter((subject): subject is string => typeof subject === "string")
      : [],
    greetingStyle: profile.greetingStyle ?? "warm",
    tone: profile.tone ?? "professional",
    formality: profile.formality ?? "balanced",
    sentenceLength: profile.sentenceLength ?? "medium",
    averageSentenceLengthWords:
      typeof profile.averageSentenceLengthWords === "number" ? profile.averageSentenceLengthWords : 14,
    directness: profile.directness ?? "balanced",
    punctuationStyle: profile.punctuationStyle ?? "standard",
    capitalizationStyle: profile.capitalizationStyle ?? "sentence_case",
    usesEmDash: typeof profile.usesEmDash === "boolean" ? profile.usesEmDash : false,
    usesBullets: typeof profile.usesBullets === "boolean" ? profile.usesBullets : false,
    signOffStyle: profile.signOffStyle ?? "best",
    signatureUsage: profile.signatureUsage ?? "none",
    signatureBlock: profile.signatureBlock,
    commonPhrases: Array.isArray(profile.commonPhrases)
      ? profile.commonPhrases.filter((phrase): phrase is string => typeof phrase === "string")
      : [],
    structuralHabits: Array.isArray(profile.structuralHabits)
      ? profile.structuralHabits.filter((habit): habit is string => typeof habit === "string")
      : ["keeps replies concise and straightforward"],
    formattingHabits: Array.isArray(profile.formattingHabits)
      ? profile.formattingHabits.filter((habit): habit is string => typeof habit === "string")
      : ["prefers plain paragraph formatting"],
    styleAnchors: {
      greetingExamples: Array.isArray(profile.styleAnchors?.greetingExamples)
        ? profile.styleAnchors.greetingExamples.filter((value): value is string => typeof value === "string")
        : [],
      openingLineExamples: Array.isArray(profile.styleAnchors?.openingLineExamples)
        ? profile.styleAnchors.openingLineExamples.filter((value): value is string => typeof value === "string")
        : [],
      closingLineExamples: Array.isArray(profile.styleAnchors?.closingLineExamples)
        ? profile.styleAnchors.closingLineExamples.filter((value): value is string => typeof value === "string")
        : [],
      signOffExamples: Array.isArray(profile.styleAnchors?.signOffExamples)
        ? profile.styleAnchors.signOffExamples.filter((value): value is string => typeof value === "string")
        : [],
      signatureExamples: Array.isArray(profile.styleAnchors?.signatureExamples)
        ? profile.styleAnchors.signatureExamples.filter((value): value is string => typeof value === "string")
        : [],
      formattingPatterns: Array.isArray(profile.styleAnchors?.formattingPatterns)
        ? profile.styleAnchors.formattingPatterns.filter((value): value is string => typeof value === "string")
        : [],
    },
  }
}

function normalizeLineBreaks(value: string) {
  return value.replace(/\r\n/g, "\n")
}

function cleanBody(bodyText: string) {
  return normalizeLineBreaks(bodyText)
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim()
}

function stripQuotedReplyText(bodyText: string) {
  const normalized = cleanBody(bodyText)
  const quoteMarkers = [
    /\nOn .+wrote:\n/i,
    /\nFrom:\s.+\nSent:\s.+\nTo:\s.+\nSubject:\s.+/i,
    /\n-{2,}\s*Original Message\s*-{2,}\n/i,
    /\n>.+/i,
  ]

  let clipped = normalized
  for (const marker of quoteMarkers) {
    const match = clipped.match(marker)
    if (match?.index && match.index > 0) {
      clipped = clipped.slice(0, match.index).trim()
    }
  }

  return clipped
}

function getNonEmptyLines(text: string) {
  return cleanBody(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

function getFirstContentLine(sample: SentEmailSample) {
  return getNonEmptyLines(sample.bodyText)[0] ?? ""
}

function getSecondContentLine(sample: SentEmailSample) {
  return getNonEmptyLines(sample.bodyText)[1] ?? ""
}

function getLastContentLines(sample: SentEmailSample, count = 4) {
  const lines = getNonEmptyLines(sample.bodyText)
  return lines.slice(-count)
}

function uniqueTrimmed(values: string[], limit: number) {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    )
  ).slice(0, limit)
}

function isReplyHeaderLikeLine(line: string) {
  const normalized = line.trim()
  if (!normalized) return true
  if (/wrote:$/i.test(normalized)) return true
  if (/^(from|sent|to|subject):/i.test(normalized)) return true
  if (/^>+/.test(normalized)) return true
  return false
}

function isSafeOpeningLineExample(line: string) {
  const normalized = line.trim()
  if (!normalized || isReplyHeaderLikeLine(normalized)) return false
  if (normalized.length > 90) return false
  if (/\d/.test(normalized)) return false
  if (/@|https?:\/\/|www\./i.test(normalized)) return false
  if (/\b(attached|attachment|minutes|drafts|review|availability|tuesday|wednesday|thursday|friday|monday|saturday|sunday)\b/i.test(normalized)) {
    return false
  }

  return /^(thanks|thank you|appreciate|happy to|sounds good|please let me know|let me know|no problem)\b/i.test(
    normalized
  )
}

function isSafeClosingLineExample(line: string, signatureBlock?: string) {
  const normalized = line.trim()
  if (!normalized || isReplyHeaderLikeLine(normalized)) return false
  if (normalized.length > 90) return false
  if (signatureBlock && normalized.includes(signatureBlock)) return false
  if (/@|https?:\/\/|www\./i.test(normalized)) return false

  return /\b(let me know|follow up|follow-up|happy to|appreciate it|talk soon|thanks again|sounds good)\b/i.test(
    normalized
  )
}

function getParagraphCount(sample: SentEmailSample) {
  return stripQuotedReplyText(sample.bodyText)
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean).length
}

function getWordCount(text: string) {
  return text.split(/\s+/).filter(Boolean).length
}

function getSentenceLengths(samples: SentEmailSample[]) {
  const text = samples.map((sample) => cleanBody(sample.bodyText)).join(" ")
  const sentences = text
    .split(/[.!?]+\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)

  const lengths = sentences.map((sentence) => sentence.split(/\s+/).filter(Boolean).length)
  return {
    sentences,
    lengths,
    averageWords:
      lengths.length > 0 ? lengths.reduce((sum, length) => sum + length, 0) / lengths.length : 14,
  }
}

function getGreetingStyle(samples: SentEmailSample[]): GreetingStyle {
  let formal = 0
  let warm = 0
  let casual = 0
  let minimal = 0
  let none = 0

  for (const sample of samples) {
    const line = getFirstContentLine(sample).toLowerCase()
    if (!line) {
      none += 1
    } else if (/^(hello|good morning|good afternoon|dear)\b/.test(line)) {
      formal += 1
    } else if (/^(hi|thanks for|thank you for)\b/.test(line)) {
      warm += 1
    } else if (/^(hey|hiya)\b/.test(line)) {
      casual += 1
    } else if (/^[a-z][a-z .'-]{0,25},?$/i.test(line)) {
      minimal += 1
    } else {
      none += 1
    }
  }

  const ranked: Array<[GreetingStyle, number]> = [
    ["formal", formal],
    ["warm", warm],
    ["casual", casual],
    ["minimal", minimal],
    ["none", none],
  ]

  return ranked.sort((left, right) => right[1] - left[1])[0]?.[0] ?? "warm"
}

function getTone(samples: SentEmailSample[]): TonePreference {
  const text = samples.map((sample) => cleanBody(sample.bodyText)).join("\n")
  const casualSignals = (text.match(/\b(hey|no problem|sounds good|awesome|glad|totally)\b/gi) ?? []).length
  const warmSignals = (text.match(/\b(thanks|thank you|appreciate|happy to)\b/gi) ?? []).length
  const directSignals = (text.match(/\b(please|need|can you|let me know|by eod|today)\b/gi) ?? []).length
  const exclamations = (text.match(/!/g) ?? []).length

  if (casualSignals + exclamations >= Math.max(3, warmSignals + 1)) {
    return "friendly"
  }
  if (directSignals >= warmSignals + 2) {
    return "direct"
  }
  if (warmSignals >= 3) {
    return "warm"
  }
  return "professional"
}

function getFormality(samples: SentEmailSample[]) {
  const text = samples.map((sample) => cleanBody(sample.bodyText)).join("\n")
  const formalSignals = (text.match(/\b(regards|sincerely|please|appreciate|thank you)\b/gi) ?? []).length
  const casualSignals = (text.match(/\b(hey|thanks!|no worries|yep|sounds good)\b/gi) ?? []).length
  const contractions = (text.match(/\b\w+'\w+\b/g) ?? []).length

  if (formalSignals >= casualSignals + 2 && contractions <= 8) {
    return "formal"
  }
  if (casualSignals >= formalSignals + 2) {
    return "casual"
  }
  return "balanced"
}

function getSentenceLength(samples: SentEmailSample[]) {
  const { averageWords } = getSentenceLengths(samples)

  if (averageWords <= 11) return "short"
  if (averageWords >= 22) return "long"
  return "medium"
}

function getAverageSentenceLengthWords(samples: SentEmailSample[]) {
  return Number(getSentenceLengths(samples).averageWords.toFixed(1))
}

function getDirectness(samples: SentEmailSample[]): DirectnessPreference {
  const joined = samples.map((sample) => stripQuotedReplyText(sample.bodyText)).join("\n")
  const averageWords =
    samples.reduce((sum, sample) => sum + getWordCount(stripQuotedReplyText(sample.bodyText)), 0) /
    Math.max(samples.length, 1)
  const hedgingSignals = (joined.match(/\b(just|maybe|might|perhaps|possibly|wanted to)\b/gi) ?? []).length
  const actionSignals = (joined.match(/\b(please|let me know|can you|i will|i can|next step)\b/gi) ?? [])
    .length

  if (actionSignals >= hedgingSignals + 4 || averageWords <= 45) return "high"
  if (hedgingSignals >= actionSignals + 3 || averageWords >= 110) return "low"
  return "balanced"
}

function getPunctuationStyle(samples: SentEmailSample[]): PunctuationStyle {
  const joined = samples.map((sample) => stripQuotedReplyText(sample.bodyText)).join("\n")
  const exclamations = (joined.match(/!/g) ?? []).length
  const ellipses = (joined.match(/\.\.\./g) ?? []).length
  const semicolons = (joined.match(/;/g) ?? []).length
  const questions = (joined.match(/\?/g) ?? []).length
  const punctuationSignals = exclamations + ellipses + semicolons + questions
  const totalWords = getWordCount(joined)

  if (totalWords === 0) return "standard"
  const density = punctuationSignals / totalWords
  if (density >= 0.045 || exclamations >= 4 || ellipses >= 2) return "expressive"
  if (density <= 0.012) return "light"
  return "standard"
}

function getCapitalizationStyle(samples: SentEmailSample[]): CapitalizationStyle {
  let sentenceCaseLines = 0
  let lowercaseLines = 0
  let mixedLines = 0

  for (const sample of samples) {
    for (const line of getNonEmptyLines(sample.bodyText).slice(0, 4)) {
      const alpha = line.match(/[A-Za-z]/)
      if (!alpha) continue
      const firstAlpha = alpha[0]
      if (firstAlpha === firstAlpha.toLowerCase()) {
        lowercaseLines += 1
      } else if (/^[A-Z][^A-Z]*$/.test(line.slice(0, Math.min(line.length, 24)))) {
        sentenceCaseLines += 1
      } else {
        mixedLines += 1
      }
    }
  }

  if (lowercaseLines >= sentenceCaseLines + mixedLines && lowercaseLines >= 2) {
    return "mostly_lowercase"
  }
  if (mixedLines >= sentenceCaseLines && mixedLines >= 2) {
    return "mixed"
  }
  return "sentence_case"
}

function getUsesEmDash(samples: SentEmailSample[]) {
  const usageCounts = samples.map((sample) => {
    const cleaned = stripQuotedReplyText(sample.bodyText)
    return (cleaned.match(/—/g) ?? []).length
  })
  const totalOccurrences = usageCounts.reduce((sum, count) => sum + count, 0)
  const samplesWithEmDash = usageCounts.filter((count) => count > 0).length

  // Treat em dash usage as a real style signal only when it recurs across the sample window.
  return totalOccurrences >= 2 && samplesWithEmDash >= 2
}

function getUsesBullets(samples: SentEmailSample[]) {
  return samples.some((sample) => /(^|\n)([-*]|\d+\.)\s+/m.test(sample.bodyText))
}

function normalizeSignOff(line: string): SignOffStyle | null {
  const normalized = line.toLowerCase().replace(/[!,]/g, "").trim()
  if (!normalized) return null
  if (normalized === "best regards") return "best_regards"
  if (normalized === "best") return "best"
  if (normalized === "thanks" || normalized === "thank you" || normalized === "many thanks") {
    return "thanks"
  }
  if (normalized === "regards" || normalized === "kind regards") return "regards"
  if (/^[a-z][a-z '-]{1,25}$/i.test(normalized)) return "name_only"
  return null
}

function getSignOffStyle(samples: SentEmailSample[]): SignOffStyle {
  const counts = new Map<SignOffStyle, number>()

  for (const sample of samples) {
    for (const line of getLastContentLines(sample, 5)) {
      const signOff = normalizeSignOff(line)
      if (signOff) {
        counts.set(signOff, (counts.get(signOff) ?? 0) + 1)
        break
      }
    }
  }

  const ordered = Array.from(counts.entries()).sort((left, right) => right[1] - left[1])
  return ordered[0]?.[0] ?? "best"
}

function getSignatureBlock(samples: SentEmailSample[]) {
  const signatureCounts = new Map<string, number>()

  for (const sample of samples) {
    const lines = getLastContentLines(sample, 4)
    if (lines.length < 2) continue

    const candidate = lines.slice(-2).join("\n").trim()
    if (candidate.length < 4 || candidate.length > 140) continue
    if (candidate.split("\n").length < 2) continue
    signatureCounts.set(candidate, (signatureCounts.get(candidate) ?? 0) + 1)
  }

  const match = Array.from(signatureCounts.entries()).sort((left, right) => right[1] - left[1])[0]
  return match && match[1] >= 2 ? match[0] : undefined
}

function getSignatureUsage(samples: SentEmailSample[], signatureBlock?: string): SignatureUsage {
  if (!signatureBlock) return "none"

  const matches = samples.filter((sample) => sample.bodyText.includes(signatureBlock)).length
  const ratio = matches / Math.max(samples.length, 1)
  if (ratio >= 0.6) return "consistent"
  if (ratio >= 0.2) return "occasional"
  return "none"
}

function getCommonPhrases(samples: SentEmailSample[]) {
  const phraseCounts = new Map<string, number>()
  const candidatePatterns = [
    "thank you for the email",
    "thanks",
    "thank you",
    "appreciate it",
    "appreciate you",
    "let me know",
    "please let me know",
    "if anything else is needed",
    "sounds good",
    "happy to",
    "best regards",
    "best",
    "regards",
    "no problem",
    "talk soon",
    "please send",
  ]

  for (const sample of samples) {
    const text = stripQuotedReplyText(sample.bodyText).toLowerCase()
    for (const phrase of candidatePatterns) {
      if (text.includes(phrase)) {
        phraseCounts.set(phrase, (phraseCounts.get(phrase) ?? 0) + 1)
      }
    }
  }

  return Array.from(phraseCounts.entries())
    .filter(([, count]) => count >= 2)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([phrase]) => phrase)
}

function getStructuralHabits(samples: SentEmailSample[]) {
  const habits = new Set<string>()
  const paragraphCounts = samples.map(getParagraphCount)
  const singleParagraphCount = paragraphCounts.filter((count) => count <= 1).length
  const multiParagraphCount = paragraphCounts.filter((count) => count >= 2).length
  const bulletCount = samples.filter((sample) => /(^|\n)([-*]|\d+\.)\s+/m.test(sample.bodyText)).length
  const opensWithThanksCount = samples.filter((sample) => {
    const firstLine = getFirstContentLine(sample).toLowerCase()
    return /^(thanks|thank you|appreciate)/.test(firstLine)
  }).length
  const closesWithNextStepCount = samples.filter((sample) =>
    /\b(let me know|i will|i can|next step|follow up)\b/i.test(getLastContentLines(sample, 6).join(" "))
  ).length

  if (singleParagraphCount >= Math.ceil(samples.length * 0.6)) habits.add("often uses a single compact paragraph")
  if (multiParagraphCount >= Math.ceil(samples.length * 0.45)) habits.add("often breaks replies into short paragraphs")
  if (bulletCount >= 2) habits.add("occasionally uses bullets when clarifying multiple points")
  if (opensWithThanksCount >= Math.ceil(samples.length * 0.35)) habits.add("often opens by acknowledging the sender")
  if (closesWithNextStepCount >= Math.ceil(samples.length * 0.35)) habits.add("often closes with a concrete next step")

  return Array.from(habits).slice(0, 4)
}

function getFormattingHabits(samples: SentEmailSample[]) {
  const habits = new Set<string>()
  const paragraphCounts = samples.map(getParagraphCount)
  const multiParagraphCount = paragraphCounts.filter((count) => count >= 2).length
  const greetingNoneCount = samples.filter((sample) => getFirstContentLine(sample).trim().length === 0).length
  const bullets = getUsesBullets(samples)
  const emDash = getUsesEmDash(samples)

  if (multiParagraphCount >= Math.ceil(samples.length * 0.45)) {
    habits.add("often uses short paragraph breaks")
  } else {
    habits.add("usually writes in one compact block")
  }

  if (bullets) habits.add("sometimes uses bullets or numbered lists")
  if (emDash) habits.add("uses em dashes for emphasis or transitions")
  if (greetingNoneCount >= Math.ceil(samples.length * 0.4)) {
    habits.add("often skips a formal greeting")
  }

  return Array.from(habits).slice(0, 4)
}

function getStyleAnchors(samples: SentEmailSample[], signatureBlock?: string) {
  const greetingExamples = uniqueTrimmed(
    samples
      .map((sample) => getFirstContentLine(sample))
      .filter((line) => /^(hello|hi|hey|dear)\b/i.test(line)),
    4
  )

  const openingLineExamples = uniqueTrimmed(
    samples
      .map((sample) => {
        const first = getFirstContentLine(sample)
        const second = getSecondContentLine(sample)
        return /^(hello|hi|hey|dear)\b/i.test(first) ? second : first
      })
      .filter((line): line is string => Boolean(line) && isSafeOpeningLineExample(line)),
    5
  )

  const signOffExamples = uniqueTrimmed(
    samples
      .map((sample) => {
        const lines = getLastContentLines(sample, 5)
        return lines.find((line) =>
          /^(best regards|best|thanks|thank you|regards|kind regards)$/i.test(
            line.replace(/[!,]/g, "").trim()
          )
        )
      })
      .filter(Boolean) as string[],
    4
  )

  const signatureExamples = uniqueTrimmed(
    samples
      .map((sample) => {
        const lines = getLastContentLines(sample, 4)
        if (!signatureBlock) {
          return lines.at(-1) ?? ""
        }
        return lines.find((line) => line.includes(signatureBlock)) ?? ""
      })
      .filter(Boolean) as string[],
    3
  )

  const closingLineExamples = uniqueTrimmed(
    samples
      .map((sample) => {
        const lines = getLastContentLines(sample, 6)
        const filtered = lines.filter(
          (line) =>
            !/^(best regards|best|thanks|thank you|regards|kind regards)$/i.test(
              line.replace(/[!,]/g, "").trim()
            ) &&
            (!signatureBlock || !line.includes(signatureBlock))
        )
        return filtered.at(-1) ?? ""
      })
      .filter((line): line is string => Boolean(line) && isSafeClosingLineExample(line, signatureBlock)),
    5
  )

  const formattingPatterns = uniqueTrimmed(
    [
      ...getFormattingHabits(samples),
      ...getStructuralHabits(samples),
    ],
    5
  )

  return {
    greetingExamples,
    openingLineExamples,
    closingLineExamples,
    signOffExamples,
    signatureExamples,
    formattingPatterns,
  }
}

function buildFallbackEmailStyleProfile(displayName?: string | null): EmailStyleProfile {
  return {
    profileVersion: CURRENT_PROFILE_VERSION,
    source: "fallback",
    analyzedAt: new Date().toISOString(),
    sampleCount: 0,
    sampledEmailSubjects: [],
    greetingStyle: "warm",
    tone: "professional",
    formality: "balanced",
    sentenceLength: "medium",
    averageSentenceLengthWords: 14,
    directness: "balanced",
    punctuationStyle: "standard",
    capitalizationStyle: "sentence_case",
    usesEmDash: false,
    usesBullets: false,
    signOffStyle: "best",
    signatureUsage: displayName ? "consistent" : "none",
    signatureBlock: displayName ? `${displayName}` : undefined,
    commonPhrases: ["thanks", "let me know"],
    structuralHabits: ["keeps replies concise and straightforward"],
    formattingHabits: ["prefers plain paragraph formatting"],
    styleAnchors: {
      greetingExamples: displayName ? [`Hello,`] : [],
      openingLineExamples: ["Thank you for the email."],
      closingLineExamples: ["Please let me know if anything else is needed."],
      signOffExamples: ["Best regards,"],
      signatureExamples: displayName ? [displayName] : [],
      formattingPatterns: ["prefers plain paragraph formatting"],
    },
  }
}

function analyzeSentMail(samples: SentEmailSample[], displayName?: string | null): EmailStyleProfile {
  const meaningfulSamples = samples
    .map((sample) => ({
      ...sample,
      bodyText: stripQuotedReplyText(sample.bodyText),
    }))
    .filter((sample) => getWordCount(sample.bodyText) >= 8)

  if (meaningfulSamples.length < 3) {
    return buildFallbackEmailStyleProfile(displayName)
  }

  const signatureBlock = getSignatureBlock(meaningfulSamples) ?? (displayName ? `${displayName}` : undefined)
  const sampleWindow = meaningfulSamples.slice(0, 10)
  const styleAnchors = getStyleAnchors(sampleWindow, signatureBlock)

  return {
    profileVersion: CURRENT_PROFILE_VERSION,
    source: "sent_mail",
    analyzedAt: new Date().toISOString(),
    sampleCount: sampleWindow.length,
    sampledEmailSubjects: sampleWindow.map((sample) => sample.subject).slice(0, 10),
    greetingStyle: getGreetingStyle(sampleWindow),
    tone: getTone(sampleWindow),
    formality: getFormality(sampleWindow),
    sentenceLength: getSentenceLength(sampleWindow),
    averageSentenceLengthWords: getAverageSentenceLengthWords(sampleWindow),
    directness: getDirectness(sampleWindow),
    punctuationStyle: getPunctuationStyle(sampleWindow),
    capitalizationStyle: getCapitalizationStyle(sampleWindow),
    usesEmDash: getUsesEmDash(sampleWindow),
    usesBullets: getUsesBullets(sampleWindow),
    signOffStyle: getSignOffStyle(sampleWindow),
    signatureUsage: getSignatureUsage(sampleWindow, signatureBlock),
    signatureBlock,
    commonPhrases: getCommonPhrases(sampleWindow),
    structuralHabits: getStructuralHabits(sampleWindow),
    formattingHabits: getFormattingHabits(sampleWindow),
    styleAnchors,
  }
}

async function readStore(): Promise<EmailStyleStore> {
  try {
    const parsed = (await getStore("email-style-profiles")) as Record<string, Partial<EmailStyleProfile>> | null
    if (!parsed || typeof parsed !== "object") return {}
    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [key, normalizeStoredProfile(value)])
    )
  } catch (error) {
    console.error("Failed to read email style store:", error)
    return {}
  }
}

async function writeStore(records: EmailStyleStore) {
  await setStore("email-style-profiles", records)
}

function isFresh(profile?: EmailStyleProfile) {
  if (!profile) return false
  if (profile.profileVersion !== CURRENT_PROFILE_VERSION) return false
  return Date.now() - new Date(profile.analyzedAt).getTime() < PROFILE_STALE_MS
}

export async function getEmailStyleProfile(params: {
  email?: string | null
  displayName?: string | null
}) {
  const key = normalizeEmail(params.email)
  if (!key) {
    return buildFallbackEmailStyleProfile(params.displayName)
  }

  const store = await readStore()
  const stored = store[key]
  if (isFresh(stored)) {
    return stored
  }

  try {
    const samples = await getRecentSentEmailSamples(key, 18)
    const profile = analyzeSentMail(samples, params.displayName)
    store[key] = profile
    await writeStore(store)
    return profile
  } catch (error) {
    console.warn("Sent-mail style analysis failed:", error)
    return stored?.profileVersion === CURRENT_PROFILE_VERSION
      ? stored
      : buildFallbackEmailStyleProfile(params.displayName)
  }
}

export async function getRelayPersonalization(params: {
  email?: string | null
  displayName?: string | null
}): Promise<{
  styleProfile: EmailStyleProfile
  settings: RelayCustomizationSettings
}> {
  const [styleProfile, settings] = await Promise.all([
    getEmailStyleProfile(params),
    getRelayCustomizationSettings(params.email),
  ])

  return {
    styleProfile,
    settings,
  }
}
