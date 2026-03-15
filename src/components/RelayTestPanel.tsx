"use client";

import { useState } from "react";
import type { AgentDecision } from "../../types";

export default function RelayTestPanel() {
  const [open, setOpen] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [goals, setGoals] = useState("");
  const [pushBack, setPushBack] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AgentDecision | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runDecide() {
    if (!transcript.trim()) return;
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const goalList = goals.split("\n").map((s) => s.trim()).filter(Boolean);
      const pushBackList = pushBack.split("\n").map((s) => s.trim()).filter(Boolean);
      const body: Record<string, unknown> = { transcriptChunk: transcript };
      if (goalList.length || pushBackList.length) {
        body.meetingSpecific = { goals: goalList, pushBackOn: pushBackList, thresholds: [] };
      }
      const res = await fetch("/api/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      setResult(data.decision as AgentDecision);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="rounded-xl border-2 border-[var(--pixel-shadow)] bg-[var(--pixel-panel)] p-5 shadow-md">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wide"
        style={{ color: "var(--pixel-text)" }}
      >
        <span>Test Relay</span>
        <span className="text-[10px]" style={{ color: "var(--pixel-text-light)" }}>
          {open ? "▲ hide" : "▼ expand"}
        </span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          <p className="text-[10px]" style={{ color: "var(--pixel-text-light)" }}>
            Paste a transcript chunk and see what Relay would say in a real meeting.{" "}
            <a href="/onboarding" className="underline" style={{ color: "var(--pixel-highlight)" }}>
              Set up your profile first →
            </a>
          </p>

          {/* Transcript input */}
          <div>
            <label
              className="block text-[10px] font-bold uppercase mb-1"
              style={{ color: "var(--pixel-text-light)" }}
            >
              Transcript chunk
            </label>
            <textarea
              rows={5}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder={`Paste a snippet from a meeting, e.g.:\n"Sarah: Can you commit to delivering this by end of next week?\nBob: We'd need the full team on it..."`}
              className="w-full border-2 border-[var(--pixel-border)] px-2 py-1.5 text-xs bg-[var(--pixel-highlight)]/50 text-[var(--pixel-text)] placeholder:opacity-40 rounded"
            />
          </div>

          {/* Optional meeting context */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label
                className="block text-[10px] font-bold uppercase mb-1"
                style={{ color: "var(--pixel-text-light)" }}
              >
                Meeting goals (optional, one per line)
              </label>
              <textarea
                rows={3}
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                placeholder="e.g. Agree on a realistic delivery date"
                className="w-full border-2 border-[var(--pixel-border)] px-2 py-1.5 text-xs bg-[var(--pixel-highlight)]/50 text-[var(--pixel-text)] placeholder:opacity-40 rounded"
              />
            </div>
            <div>
              <label
                className="block text-[10px] font-bold uppercase mb-1"
                style={{ color: "var(--pixel-text-light)" }}
              >
                Push back on (optional, one per line)
              </label>
              <textarea
                rows={3}
                value={pushBack}
                onChange={(e) => setPushBack(e.target.value)}
                placeholder="e.g. Unrealistic timelines without scope reduction"
                className="w-full border-2 border-[var(--pixel-border)] px-2 py-1.5 text-xs bg-[var(--pixel-highlight)]/50 text-[var(--pixel-text)] placeholder:opacity-40 rounded"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={runDecide}
            disabled={running || !transcript.trim()}
            className="px-4 py-2 border-2 border-[var(--pixel-border)] text-xs font-bold uppercase disabled:opacity-50"
            style={{ background: "var(--pixel-panel-dark)", color: "var(--pixel-highlight)" }}
          >
            {running ? "Asking Relay…" : "Ask Relay"}
          </button>

          {/* Error */}
          {error && (
            <div
              className="text-[10px] px-3 py-2 rounded border"
              style={{ color: "var(--pixel-stress)", borderColor: "var(--pixel-stress)" }}
            >
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-3 pt-1">
              {/* Spoke / silent verdict */}
              <div
                className={`rounded-lg border-2 px-4 py-3 ${
                  result.spoke ? "border-[var(--pixel-highlight)]" : "border-[var(--pixel-shadow)]"
                }`}
              >
                <p
                  className="text-[10px] font-bold uppercase mb-1"
                  style={{ color: result.spoke ? "var(--pixel-highlight)" : "var(--pixel-text-light)" }}
                >
                  {result.spoke ? "Relay would speak" : "Relay stays silent"}
                </p>
                <p className="text-[10px]" style={{ color: "var(--pixel-text-light)" }}>
                  {result.judgmentReason}
                </p>
              </div>

              {/* Suggested response */}
              {result.spoke && result.response && (
                <div
                  className="rounded-lg border-2 px-4 py-3"
                  style={{
                    borderColor: "var(--pixel-highlight)",
                    background: "color-mix(in srgb, var(--pixel-highlight) 8%, transparent)",
                  }}
                >
                  <p
                    className="text-[10px] font-bold uppercase mb-2"
                    style={{ color: "var(--pixel-text-light)" }}
                  >
                    Suggested response
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--pixel-text)" }}>
                    {result.response}
                  </p>
                </div>
              )}

              {/* Confidence bar */}
              {result.confidence && (
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span
                      className="text-[10px] font-bold uppercase w-20 shrink-0"
                      style={{ color: "var(--pixel-text-light)" }}
                    >
                      Confidence
                    </span>
                    <div className="flex-1 h-2 rounded-full border border-[var(--pixel-shadow)] bg-[var(--pixel-hp-bg)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--pixel-hp)] transition-all"
                        style={{ width: `${result.confidence.score * 100}%` }}
                      />
                    </div>
                    <span
                      className="text-[10px] font-mono shrink-0"
                      style={{ color: "var(--pixel-text)" }}
                    >
                      {Math.round(result.confidence.score * 100)}%
                    </span>
                  </div>
                  <p className="text-[10px] pl-[5.5rem]" style={{ color: "var(--pixel-text-light)" }}>
                    {result.confidence.reasoning}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
