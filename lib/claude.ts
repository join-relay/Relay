/**
 * Relay — Claude API client
 * Uses Haiku by default to minimize cost for the three-call agent cycle.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ClaudeClient, ClaudeMessage } from "./agent";

const DEFAULT_MODEL = "claude-haiku-4-5";

/**
 * Builds a Claude client that matches the agent's ClaudeClient interface.
 * Uses ANTHROPIC_API_KEY from env. Prefer Haiku for cost; override model if needed.
 */
export function createClaudeClient(options?: {
  apiKey?: string;
  model?: string;
}): ClaudeClient {
  const apiKey = options?.apiKey ?? process.env.ANTHROPIC_API_KEY;
  const model = options?.model ?? DEFAULT_MODEL;

  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env or pass apiKey to createClaudeClient."
    );
  }

  const anthropic = new Anthropic({ apiKey });

  return {
    async complete(messages, systemPrompt) {
      const response = await anthropic.messages.create({
        model,
        max_tokens: 1024,
        system: systemPrompt ?? "",
        messages: messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      });

      const text = response.content
        .filter((block): block is { type: "text"; text: string } => block.type === "text")
        .map((block) => block.text)
        .join("");

      return text;
    },
  };
}

/**
 * Shared client instance. Call createClaudeClient() once (e.g. at app startup)
 * or use this after ensuring ANTHROPIC_API_KEY is set.
 */
let defaultClient: ClaudeClient | null = null;

export function getClaudeClient(options?: { apiKey?: string; model?: string }): ClaudeClient {
  if (defaultClient) return defaultClient;
  defaultClient = createClaudeClient(options);
  return defaultClient;
}

export function setClaudeClient(client: ClaudeClient | null): void {
  defaultClient = client;
}
