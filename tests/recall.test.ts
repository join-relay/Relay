import { describe, it, expect } from "vitest"
import crypto from "node:crypto"
import { verifyRecallWebhook } from "../lib/recall/verify-webhook"

describe("verifyRecallWebhook", () => {
  const secret = "whsec_" + Buffer.from("test-secret-32-bytes-long!!!!!").toString("base64")
  const msgId = "msg_test123"
  const msgTimestamp = "1731705121"
  const payload = '{"event":"bot.joining_call","data":{}}'

  function computeSignature(secretKey: string, msgId: string, msgTimestamp: string, payloadStr: string): string {
    const prefix = "whsec_"
    const base64Part = secretKey.startsWith(prefix) ? secretKey.slice(prefix.length) : secretKey
    const key = Buffer.from(base64Part, "base64")
    const toSign = `${msgId}.${msgTimestamp}.${payloadStr}`
    return crypto.createHmac("sha256", key).update(toSign).digest("base64")
  }

  it("accepts valid signature in webhook-signature header", () => {
    const sig = computeSignature(secret, msgId, msgTimestamp, payload)
    const headers: Record<string, string> = {
      "webhook-id": msgId,
      "webhook-timestamp": msgTimestamp,
      "webhook-signature": `v1,${sig}`,
    }
    expect(() => verifyRecallWebhook({ secret, headers, payload })).not.toThrow()
  })

  it("accepts valid signature in svix-* headers", () => {
    const sig = computeSignature(secret, msgId, msgTimestamp, payload)
    const headers: Record<string, string> = {
      "svix-id": msgId,
      "svix-timestamp": msgTimestamp,
      "svix-signature": `v1,${sig}`,
    }
    expect(() => verifyRecallWebhook({ secret, headers, payload })).not.toThrow()
  })

  it("accepts null payload for GET/upgrade requests", () => {
    const emptyPayload = ""
    const toSign = `${msgId}.${msgTimestamp}.${emptyPayload}`
    const key = Buffer.from(secret.slice(6), "base64")
    const sig = crypto.createHmac("sha256", key).update(toSign).digest("base64")
    const headers: Record<string, string> = {
      "webhook-id": msgId,
      "webhook-timestamp": msgTimestamp,
      "webhook-signature": `v1,${sig}`,
    }
    expect(() => verifyRecallWebhook({ secret, headers, payload: null })).not.toThrow()
  })

  it("rejects invalid signature", () => {
    const headers: Record<string, string> = {
      "webhook-id": msgId,
      "webhook-timestamp": msgTimestamp,
      "webhook-signature": "v1,dGhpcyBpcyBub3QgYSB2YWxpZCBzaWc=",
    }
    expect(() => verifyRecallWebhook({ secret, headers, payload })).toThrow("No matching signature found")
  })

  it("rejects missing webhook-id", () => {
    const sig = computeSignature(secret, msgId, msgTimestamp, payload)
    const headers: Record<string, string> = {
      "webhook-timestamp": msgTimestamp,
      "webhook-signature": `v1,${sig}`,
    }
    expect(() => verifyRecallWebhook({ secret, headers, payload })).toThrow("Missing webhook headers")
  })

  it("rejects missing secret", () => {
    const headers: Record<string, string> = {
      "webhook-id": msgId,
      "webhook-timestamp": msgTimestamp,
      "webhook-signature": "v1,anything",
    }
    expect(() => verifyRecallWebhook({ secret: "", headers, payload })).toThrow("secret is missing")
  })
})
