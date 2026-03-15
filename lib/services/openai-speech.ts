import "server-only"

import OpenAI, { toFile } from "openai"

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const client = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null

/**
 * TTS boundary: generate a spoken-update audio artifact from text.
 * Server-side only. Returns metadata (no actual binary stored in this pass;
 * artifactUrl can be populated if we persist the audio blob or use a CDN).
 */
export async function generateSpokenUpdateAudio(text: string): Promise<{
  generated: boolean
  artifactUrl?: string
  failureReason?: string
}> {
  if (!client) {
    return {
      generated: false,
      failureReason: "OPENAI_API_KEY is not set. Spoken update generation is unavailable.",
    }
  }
  try {
    const response = await client.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: text.slice(0, 4096),
    })
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length === 0) {
      return { generated: false, failureReason: "Empty audio response." }
    }
    return {
      generated: true,
      artifactUrl: `data:audio/mp3;base64,${buffer.toString("base64")}`,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return {
      generated: false,
      failureReason: message,
    }
  }
}

/**
 * STT boundary: transcribe audio (e.g. from uploaded or retrieved meeting artifact).
 * Server-side only. Use when processing meeting audio for recap.
 */
export async function transcribeAudio(buffer: Buffer): Promise<{
  text: string | null
  failureReason?: string
}> {
  if (!client) {
    return { text: null, failureReason: "OPENAI_API_KEY is not set." }
  }
  try {
    const file = await toFile(buffer, "audio.mp3", { type: "audio/mpeg" })
    const transcription = await client.audio.transcriptions.create({
      file,
      model: "whisper-1",
    })
    return { text: transcription.text?.trim() ?? null }
  } catch (err) {
    return {
      text: null,
      failureReason: err instanceof Error ? err.message : "Transcription failed",
    }
  }
}
