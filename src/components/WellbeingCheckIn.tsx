"use client";

import { useState } from "react";

type Props = { onSubmitted?: () => void };

export default function WellbeingCheckIn({ onSubmitted }: Props) {
  const [energy, setEnergy] = useState<number | "">("");
  const [overwhelm, setOverwhelm] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/wellbeing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          energyScore: energy === "" ? undefined : energy,
          overwhelmScore: overwhelm === "" ? undefined : overwhelm,
          note: note.trim() || undefined,
        }),
      });
      if (res.ok) {
        setSent(true);
        setEnergy("");
        setOverwhelm("");
        setNote("");
        onSubmitted?.();
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <section
      className="rounded-xl border-2 border-[var(--pixel-shadow)] bg-[var(--pixel-panel)] p-5 shadow-md"
    >
      <h2 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "var(--pixel-text)" }}>
        Wellbeing check-in
      </h2>
      <p className="text-[10px] mb-3" style={{ color: "var(--pixel-text-light)" }}>
        How are you doing? Stored with your current work-life snapshot.
      </p>
      {sent && (
        <p className="text-[10px] mb-2" style={{ color: "var(--pixel-highlight)" }}>Check-in saved. Thanks.</p>
      )}
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: "var(--pixel-text-light)" }}>
            Energy (1=low, 5=high)
          </label>
          <select
            value={energy === "" ? "" : String(energy)}
            onChange={(e) => setEnergy(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-full max-w-[140px] border-2 border-[var(--pixel-border)] px-2 py-1 text-xs bg-[var(--pixel-highlight)]/50"
            style={{ color: "var(--pixel-text)" }}
          >
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: "var(--pixel-text-light)" }}>
            Overwhelm (1=calm, 5=very overwhelmed)
          </label>
          <select
            value={overwhelm === "" ? "" : String(overwhelm)}
            onChange={(e) => setOverwhelm(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-full max-w-[140px] border-2 border-[var(--pixel-border)] px-2 py-1 text-xs bg-[var(--pixel-highlight)]/50"
            style={{ color: "var(--pixel-text)" }}
          >
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: "var(--pixel-text-light)" }}>Note (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything you want to note..."
            rows={2}
            className="w-full border-2 border-[var(--pixel-border)] px-2 py-1 text-xs bg-[var(--pixel-highlight)]/50 placeholder-opacity-60"
            style={{ color: "var(--pixel-text)" }}
          />
        </div>
        <button
          type="submit"
          disabled={sending}
          className="px-3 py-1.5 border-2 border-[var(--pixel-border)] text-xs font-bold uppercase disabled:opacity-50 hover:opacity-90"
          style={{ background: "var(--pixel-panel-dark)", color: "var(--pixel-highlight)" }}
        >
          {sending ? "Saving…" : "Save check-in"}
        </button>
      </form>
    </section>
  );
}
