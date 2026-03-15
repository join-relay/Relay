import crypto from "node:crypto"

/**
 * Verify Recall.ai webhook request (workspace verification secret).
 * Uses webhook-id, webhook-timestamp, webhook-signature (or svix-* headers) and HMAC-SHA256.
 * @see https://docs.recall.ai/docs/authenticating-requests-from-recallai
 */
export function verifyRecallWebhook(args: {
  secret: string
  headers: Record<string, string | undefined>
  payload: string | null
}): void {
  const { secret, headers, payload } = args
  const normalizedHeaders: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    if (v !== undefined) normalizedHeaders[k.toLowerCase()] = v
  }
  const msgId = normalizedHeaders["webhook-id"] ?? normalizedHeaders["svix-id"]
  const msgTimestamp = normalizedHeaders["webhook-timestamp"] ?? normalizedHeaders["svix-timestamp"]
  const msgSignature = normalizedHeaders["webhook-signature"] ?? normalizedHeaders["svix-signature"]

  if (!secret || !secret.trim()) {
    throw new Error("Verification secret is missing")
  }
  if (!msgId || !msgTimestamp || !msgSignature) {
    throw new Error(
      `Missing webhook headers: id=${msgId ? "present" : "missing"}, timestamp=${msgTimestamp ? "present" : "missing"}, signature=${msgSignature ? "present" : "missing"}`
    )
  }

  const prefix = "whsec_"
  const base64Part = secret.startsWith(prefix) ? secret.slice(prefix.length) : secret
  let key: Buffer
  try {
    key = Buffer.from(base64Part, "base64")
  } catch {
    throw new Error("Invalid verification secret: base64 decode failed")
  }

  const payloadStr = payload ?? ""
  const toSign = `${msgId}.${msgTimestamp}.${payloadStr}`
  const expectedSig = crypto.createHmac("sha256", key).update(toSign).digest("base64")

  const passedSigs = msgSignature.split(" ")
  for (const versionedSig of passedSigs) {
    const [version, signature] = versionedSig.split(",")
    if (version !== "v1" || !signature) continue
    try {
      const sigBytes = Buffer.from(signature.trim(), "base64")
      const expectedSigBytes = Buffer.from(expectedSig, "base64")
      if (
        expectedSigBytes.length === sigBytes.length &&
        crypto.timingSafeEqual(new Uint8Array(expectedSigBytes), new Uint8Array(sigBytes))
      ) {
        return
      }
    } catch {
      continue
    }
  }

  throw new Error("No matching signature found")
}
