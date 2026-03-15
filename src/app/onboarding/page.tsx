"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Layer1 = {
  communicationStyle: string;
  decisionOwnership: string;
  hardLimits: string[];
  riskTolerance: string;
};

type Layer2 = {
  currentProjects: string[];
  recentDecisions: string[];
  calendarPressure: string;
};

const inputCls =
  "w-full border-2 border-[var(--pixel-border)] px-2 py-1.5 text-xs bg-[var(--pixel-highlight)]/50 text-[var(--pixel-text)] placeholder:opacity-50 rounded";

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-[var(--pixel-shadow)] bg-[var(--pixel-panel)] p-5 shadow-md">
      <h2 className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "var(--pixel-text)" }}>
        {title}
      </h2>
      {subtitle && (
        <p className="text-[10px] mb-4" style={{ color: "var(--pixel-text-light)" }}>{subtitle}</p>
      )}
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: "var(--pixel-text-light)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function DynamicList({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex gap-1.5">
          <input
            type="text"
            value={item}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
            placeholder={i === 0 ? placeholder : ""}
            className="flex-1 border-2 border-[var(--pixel-border)] px-2 py-1 text-xs bg-[var(--pixel-highlight)]/50 text-[var(--pixel-text)] placeholder:opacity-50 rounded"
          />
          {items.length > 1 && (
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="px-2 border border-[var(--pixel-shadow)] text-xs rounded"
              style={{ color: "var(--pixel-stress)" }}
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="text-[10px] underline"
        style={{ color: "var(--pixel-text-light)" }}
      >
        + Add
      </button>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [userName, setUserName] = useState("");
  const [layer1, setLayer1] = useState<Layer1>({
    communicationStyle: "",
    decisionOwnership: "",
    hardLimits: [""],
    riskTolerance: "",
  });
  const [layer2, setLayer2] = useState<Layer2>({
    currentProjects: [""],
    recentDecisions: [""],
    calendarPressure: "",
  });

  useEffect(() => {
    fetch("/api/you-model")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.model) {
          const m = d.model;
          setUserName(m.userName ?? "");
          setLayer1({
            communicationStyle: m.staticIdentity?.communicationStyle ?? "",
            decisionOwnership: m.staticIdentity?.decisionOwnership ?? "",
            hardLimits: m.staticIdentity?.hardLimits?.length ? m.staticIdentity.hardLimits : [""],
            riskTolerance: m.staticIdentity?.riskTolerance ?? "",
          });
          setLayer2({
            currentProjects: m.dynamicContext?.currentProjects?.length
              ? m.dynamicContext.currentProjects
              : [""],
            recentDecisions: m.dynamicContext?.recentDecisions?.length
              ? m.dynamicContext.recentDecisions
              : [""],
            calendarPressure: m.dynamicContext?.calendarPressure ?? "",
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        userName: userName.trim() || "You",
        staticIdentity: {
          communicationStyle: layer1.communicationStyle,
          decisionOwnership: layer1.decisionOwnership,
          hardLimits: layer1.hardLimits.filter(Boolean),
          riskTolerance: layer1.riskTolerance,
        },
        dynamicContext: {
          currentProjects: layer2.currentProjects.filter(Boolean),
          recentDecisions: layer2.recentDecisions.filter(Boolean),
          calendarPressure: layer2.calendarPressure,
        },
      };
      const res = await fetch("/api/you-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => router.push("/dashboard"), 1500);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--pixel-bg)" }}>
        <p className="text-xs" style={{ color: "var(--pixel-text-light)" }}>Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: "var(--pixel-bg)" }}>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-sm font-bold uppercase tracking-wide" style={{ color: "var(--pixel-highlight)" }}>
              Your Digital Double
            </h1>
            <p className="text-[10px] mt-1" style={{ color: "var(--pixel-text-light)" }}>
              Tell Relay how to represent you in meetings — your voice, your limits, your context.
            </p>
          </div>
          <a
            href="/dashboard"
            className="text-[10px] underline shrink-0 mt-1"
            style={{ color: "var(--pixel-text-light)" }}
          >
            ← Dashboard
          </a>
        </div>

        {saved && (
          <div
            className="text-[10px] px-3 py-2 rounded border"
            style={{ color: "var(--pixel-highlight)", borderColor: "var(--pixel-highlight)" }}
          >
            Profile saved. Taking you to dashboard…
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          {/* Name */}
          <Card title="Your name">
            <Field label="Display name (used in the system prompt)">
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Your name"
                className={inputCls}
              />
            </Field>
          </Card>

          {/* Layer 1 */}
          <Card
            title="Layer 1 — Who you are"
            subtitle="Permanent. Defines your voice and non-negotiables across every meeting."
          >
            <div className="space-y-4">
              <Field label="Communication style — how you write and speak">
                <textarea
                  rows={3}
                  value={layer1.communicationStyle}
                  onChange={(e) => setLayer1((p) => ({ ...p, communicationStyle: e.target.value }))}
                  placeholder="e.g. Direct, low fluff. Short sentences. I don't apologise for decisions. Friendly but not overly warm."
                  className={inputCls}
                />
              </Field>
              <Field label="Decision ownership — what you own vs escalate">
                <textarea
                  rows={2}
                  value={layer1.decisionOwnership}
                  onChange={(e) => setLayer1((p) => ({ ...p, decisionOwnership: e.target.value }))}
                  placeholder="e.g. I own product and engineering calls up to £50k. Anything above that, or legal/HR-adjacent, I escalate."
                  className={inputCls}
                />
              </Field>
              <Field label="Hard limits — things Relay must never agree to">
                <DynamicList
                  items={layer1.hardLimits}
                  onChange={(items) => setLayer1((p) => ({ ...p, hardLimits: items }))}
                  placeholder="e.g. No NDA waivers without legal review"
                />
              </Field>
              <Field label="Risk tolerance">
                <textarea
                  rows={2}
                  value={layer1.riskTolerance}
                  onChange={(e) => setLayer1((p) => ({ ...p, riskTolerance: e.target.value }))}
                  placeholder="e.g. Comfortable with ambiguity. Move fast and course-correct rather than wait for perfect information."
                  className={inputCls}
                />
              </Field>
            </div>
          </Card>

          {/* Layer 2 */}
          <Card
            title="Layer 2 — What's happening now"
            subtitle="Update before meetings. Colours Relay's decisions with current context."
          >
            <div className="space-y-4">
              <Field label="Current projects / focus areas">
                <DynamicList
                  items={layer2.currentProjects}
                  onChange={(items) => setLayer2((p) => ({ ...p, currentProjects: items }))}
                  placeholder="e.g. Shipping the onboarding redesign by end of sprint"
                />
              </Field>
              <Field label="Recent decisions (relevant to this week)">
                <DynamicList
                  items={layer2.recentDecisions}
                  onChange={(items) => setLayer2((p) => ({ ...p, recentDecisions: items }))}
                  placeholder="e.g. Decided to drop the third-party analytics vendor"
                />
              </Field>
              <Field label="Calendar / pressure context">
                <textarea
                  rows={2}
                  value={layer2.calendarPressure}
                  onChange={(e) => setLayer2((p) => ({ ...p, calendarPressure: e.target.value }))}
                  placeholder="e.g. Three back-to-backs today. End of quarter crunch. Key stakeholder joining this call."
                  className={inputCls}
                />
              </Field>
            </div>
          </Card>

          <div className="flex gap-4 items-center">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 border-2 border-[var(--pixel-border)] text-xs font-bold uppercase disabled:opacity-50"
              style={{ background: "var(--pixel-panel-dark)", color: "var(--pixel-highlight)" }}
            >
              {saving ? "Saving…" : "Save profile"}
            </button>
            <a href="/dashboard" className="text-[10px] underline" style={{ color: "var(--pixel-text-light)" }}>
              Cancel
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
