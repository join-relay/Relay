"use client";

import { useState, useEffect, useCallback } from "react";
import type { WorkLifeContext } from "@/types/context";
import type { EmailMessage } from "@/types/context";
import { decodeHtmlEntities } from "@/lib/text";
import { getCalendarEventStyle } from "@/lib/calendar-types";

const PINNED_EMAILS_KEY = "gsuite-wellbeing-pinned-email-ids";
const EMAIL_LIST_SIZE = 40;

function loadPinnedIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PINNED_EMAILS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function savePinnedIds(ids: string[]) {
  try {
    localStorage.setItem(PINNED_EMAILS_KEY, JSON.stringify(ids));
  } catch {}
}

function isEmailImportant(m: EmailMessage): boolean {
  const text = `${m.subject} ${m.snippet || ""} ${m.bodyText || ""}`.toLowerCase();
  return m.unread || /\b(urgent|asap|deadline|review|follow up|action required)\b/.test(text);
}

type Props = {
  context: WorkLifeContext | null | "loading";
  provider?: "google" | "microsoft";
  onSync?: () => void;
  isDemo?: boolean;
};

export default function Dashboard({ context, provider, onSync, isDemo }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  useEffect(() => {
    setPinnedIds(loadPinnedIds());
  }, []);

  async function runSync() {
    if (isDemo) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      if (res.ok) onSync?.();
    } finally {
      setSyncing(false);
    }
  }

  if (context === "loading") {
    return (
      <div
        className="rounded-xl border-2 border-[var(--pixel-shadow)] bg-[var(--pixel-panel)] p-6 text-center text-xs shadow-md"
        style={{ color: "var(--pixel-text-light)" }}
      >
        Loading…
      </div>
    );
  }

  if (!context) {
    return (
      <section
        className="rounded-xl border-2 border-[var(--pixel-shadow)] bg-[var(--pixel-panel)] p-5 shadow-md"
      >
        <h2 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "var(--pixel-text)" }}>
          Work-life context
        </h2>
        <p className="text-[10px] mb-4" style={{ color: "var(--pixel-text-light)" }}>
          No data yet. Sync to pull from your connected account (Outlook + Calendar or G Suite).
        </p>
        {!isDemo && (
          <button
            onClick={runSync}
            disabled={syncing}
            className="rounded-lg px-3 py-1.5 border border-[var(--pixel-border)] text-xs font-bold uppercase disabled:opacity-50 bg-[var(--pixel-panel-dark)] text-[var(--pixel-highlight)]"
          >
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        )}
      </section>
    );
  }

  const { calendar, email, meet, docs, wellbeing, lastSyncedAt } = context;

  return (
    <div className="space-y-4">
      <section
        className="rounded-xl border-2 border-[var(--pixel-shadow)] bg-[var(--pixel-panel)] p-4 flex flex-wrap items-center justify-between gap-3 shadow-md"
      >
        <div>
          <span className="text-[10px] uppercase" style={{ color: "var(--pixel-text-light)" }}>
            {isDemo ? "Demo data (sample)" : provider === "microsoft" ? "Data from Outlook / Microsoft 365" : "Data from G Suite"}
          </span>
          {lastSyncedAt && (
            <p className="text-[10px] mt-0.5" style={{ color: "var(--pixel-text)" }}>
              {isDemo ? "Sample context for preview" : `Last synced: ${new Date(lastSyncedAt).toLocaleString()}`}
            </p>
          )}
        </div>
        {!isDemo && (
        <button
          onClick={runSync}
          disabled={syncing}
          className="rounded-lg px-3 py-1.5 border border-[var(--pixel-border)] text-xs font-bold uppercase disabled:opacity-50 bg-[var(--pixel-panel-dark)] text-[var(--pixel-highlight)]"
        >
          {syncing ? "Syncing…" : "Refresh sync"}
        </button>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2 min-w-0 h-[800px] items-stretch">
        <Section title="Calendar" source={provider === "microsoft" ? "Outlook Calendar" : "Google Calendar"} fillHeight>
          {(() => {
            const todayKey = new Date().toISOString().slice(0, 10);
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowKey = tomorrow.toISOString().slice(0, 10);
            const todayAndTomorrow = calendar.events
              .filter((e) => {
                const key = e.start.slice(0, 10);
                return key === todayKey || key === tomorrowKey;
              })
              .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
              .slice(0, 10);
            return (
              <>
                <p className="text-[10px] mb-2 flex-shrink-0" style={{ color: "var(--pixel-text-light)" }}>
                  Today + tomorrow · up to 10 events · Free block: <strong>{calendar.longestFreeBlockMinutes}</strong> min
                </p>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2 min-w-0 flex-1 min-h-0 content-start">
                  {todayAndTomorrow.map((e) => {
                    const style = getCalendarEventStyle(e.summary, e.isMeet);
                    const start = new Date(e.start);
                    const end = new Date(e.end);
                    const timeStr = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
                    const endStr = end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
                    const location = e.location?.trim();
                    const descSnippet = e.description?.replace(/\s+/g, " ").trim().slice(0, 60);
                    return (
                      <div
                        key={e.id}
                        className="rounded-lg border-l-4 px-3 py-2.5 text-[10px] min-w-0"
                        style={{
                          backgroundColor: style.bg,
                          borderLeftColor: style.border,
                          color: style.text,
                        }}
                        title={e.summary}
                      >
                        <p className="font-semibold break-words">{decodeHtmlEntities(e.summary)}</p>
                        <p className="mt-0.5 opacity-90">
                          {timeStr} – {endStr}
                        </p>
                        {location && (
                          <p className="mt-1 break-words opacity-80" title={location}>
                            📍 {decodeHtmlEntities(location.slice(0, 50))}{location.length > 50 ? "…" : ""}
                          </p>
                        )}
                        {descSnippet && (
                          <p className={`mt-1 break-words opacity-75 ${location ? "line-clamp-1" : "line-clamp-2"}`}>{decodeHtmlEntities(descSnippet)}…</p>
                        )}
                      </div>
                    );
                  })}
                </div>
                {todayAndTomorrow.length === 0 && (
                  <p className="text-[10px] mt-1" style={{ color: "var(--pixel-text-light)" }}>No events today or tomorrow</p>
                )}
              </>
            );
          })()}
        </Section>

        <EmailListSection fillHeight
          email={email}
          provider={provider}
          pinnedIds={pinnedIds}
          onPinnedChange={(ids) => {
            setPinnedIds(ids);
            savePinnedIds(ids);
          }}
        />

        <Section title="Meet" source={provider === "microsoft" ? "Outlook Calendar (online meetings)" : "Google Calendar (Meet events)"}>
          <p className="text-[10px] mb-2" style={{ color: "var(--pixel-text)" }}>
            Today: <strong>{meet.todayCount}</strong> · Week: <strong>{meet.weekCount}</strong> · Hours: <strong>{meet.totalMeetingHoursThisWeek}</strong>h
          </p>
          <ul className="mt-1 space-y-0.5 text-[10px] min-w-0 overflow-hidden">
            {meet.meetings.slice(0, 4).map((m) => (
              <li key={m.eventId} className="min-w-0 break-words">
                <span className="font-bold break-words" style={{ color: "var(--pixel-text)" }}>{m.summary}</span>
                {m.agenda && <span className="block break-words" style={{ color: "var(--pixel-text-light)" }}>{m.agenda.slice(0, 80)}…</span>}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Docs" source={provider === "microsoft" ? "— (not synced for Microsoft)" : "Google Drive & Docs"}>
          <p className="text-[10px] mb-2" style={{ color: "var(--pixel-text)" }}>
            Active (7d): <strong>{docs.activeCount}</strong> of {docs.items.length} recent
          </p>
          <ul className="mt-1 space-y-0.5 text-[10px] min-w-0 overflow-hidden">
            {docs.items.slice(0, 4).map((d) => (
              <li key={d.id} className="min-w-0 break-words">
                <span className="font-bold break-words" style={{ color: "var(--pixel-text)" }}>{d.name}</span>
                {d.commentsCount > 0 && <span style={{ color: "var(--pixel-text-light)" }}> · {d.commentsCount} comments</span>}
                {d.sectionTitles?.[0] && (
                  <span className="block break-words" style={{ color: "var(--pixel-text-light)" }}>{d.sectionTitles[0]}</span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {wellbeing.latest && (
        <section
          className="rounded-xl border-2 border-[var(--pixel-shadow)] bg-[var(--pixel-panel)] p-4 shadow-md"
        >
          <h2 className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "var(--pixel-text)" }}>Latest wellbeing</h2>
          <p className="text-[10px]" style={{ color: "var(--pixel-text)" }}>
            {new Date(wellbeing.latest.timestamp).toLocaleString()} · Energy: {wellbeing.latest.energyScore ?? "—"} · Overwhelm: {wellbeing.latest.overwhelmScore ?? "—"}
            {wellbeing.latest.note && ` · ${wellbeing.latest.note}`}
          </p>
          {wellbeing.latest.contextSnapshot && (
            <p className="text-[10px] mt-0.5" style={{ color: "var(--pixel-text-light)" }}>
              At check-in: {wellbeing.latest.contextSnapshot.meetingCount ?? 0} meetings, {wellbeing.latest.contextSnapshot.unreadCount ?? 0} unread, {wellbeing.latest.contextSnapshot.activeDocsCount ?? 0} active docs
            </p>
          )}
          {wellbeing.trend.length > 1 && (
            <p className="text-[10px] mt-0.5" style={{ color: "var(--pixel-text-light)" }}>Trend: last {wellbeing.trend.length} check-ins</p>
          )}
        </section>
      )}
    </div>
  );
}

function EmailListSection({
  email,
  provider,
  pinnedIds,
  onPinnedChange,
  fillHeight,
}: {
  email: WorkLifeContext["email"];
  provider?: "google" | "microsoft";
  pinnedIds: string[];
  onPinnedChange: (ids: string[]) => void;
  fillHeight?: boolean;
}) {
  const pinnedSet = new Set(pinnedIds);
  const sorted = [...email.messages]
    .sort((a, b) => {
      const aPin = pinnedSet.has(a.id) ? pinnedIds.indexOf(a.id) : -1;
      const bPin = pinnedSet.has(b.id) ? pinnedIds.indexOf(b.id) : -1;
      if (aPin >= 0 && bPin >= 0) return aPin - bPin;
      if (aPin >= 0) return -1;
      if (bPin >= 0) return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    })
    .slice(0, EMAIL_LIST_SIZE);

  function togglePin(id: string) {
    if (pinnedSet.has(id)) {
      onPinnedChange(pinnedIds.filter((x) => x !== id));
    } else {
      onPinnedChange([...pinnedIds, id]);
    }
  }

  return (
    <Section title="Email" source={provider === "microsoft" ? "Outlook" : "Gmail"} fillHeight={fillHeight}>
      <p className="text-[10px] mb-2 flex-shrink-0" style={{ color: "var(--pixel-text-light)" }}>
        Unread: <strong>{email.unreadCount}</strong> · Showing up to {EMAIL_LIST_SIZE} recent
      </p>
      <div
        className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-[var(--pixel-shadow)] min-w-0"
      >
        <ul className="divide-y divide-[var(--pixel-shadow)]">
          {sorted.map((m) => {
            const important = isEmailImportant(m);
            const pinned = pinnedSet.has(m.id);
            return (
              <li
                key={m.id}
                className="flex items-start gap-2 px-2 py-2 text-[10px] min-w-0 hover:bg-[var(--pixel-bg)]/50"
              >
                <div className="flex flex-shrink-0 items-center gap-0.5">
                  <span
                    className="cursor-default"
                    title={important ? "Important" : ""}
                    style={{ color: important ? "#d97706" : "var(--pixel-text-light)", opacity: important ? 1 : 0.4 }}
                    aria-hidden
                  >
                    ★
                  </span>
                  <button
                    type="button"
                    onClick={() => togglePin(m.id)}
                    className="p-0.5 rounded hover:bg-[var(--pixel-shadow)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--pixel-highlight)]"
                    title={pinned ? "Unpin" : "Pin to top"}
                    aria-label={pinned ? "Unpin email" : "Pin email to top"}
                  >
                    <PinIcon pinned={pinned} />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold break-all" style={{ color: "var(--pixel-text)" }}>
                    {decodeHtmlEntities(m.from)}
                  </p>
                  <p className="break-words font-medium" style={{ color: "var(--pixel-text)" }}>
                    {decodeHtmlEntities(m.subject.slice(0, 80))}{m.subject.length > 80 ? "…" : ""}
                  </p>
                  {(m.snippet || m.bodyText) && (
                    <p className="break-words mt-0.5 truncate max-w-full" style={{ color: "var(--pixel-text-light)" }}>
                      {decodeHtmlEntities((m.snippet || m.bodyText || "").slice(0, 120))}
                      {(m.snippet || m.bodyText || "").length > 120 ? "…" : ""}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {sorted.length === 0 && (
          <p className="p-3 text-[10px]" style={{ color: "var(--pixel-text-light)" }}>No emails yet. Sync to load.</p>
        )}
      </div>
    </Section>
  );
}

/** Thumb-tack / push pin: outline when unpinned, red fill when pinned. */
function PinIcon({ pinned }: { pinned: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={pinned ? "#dc2626" : "none"}
      stroke={pinned ? "#dc2626" : "currentColor"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: pinned ? "#dc2626" : "var(--pixel-text-light)" }}
    >
      {/* Round head */}
      <circle cx="12" cy="6" r="4" />
      {/* Pin shaft */}
      <path d="M12 10v12" />
      {/* Point */}
      <path d="M8 22h8" />
    </svg>
  );
}

function Section({
  title,
  source,
  children,
  fillHeight,
}: {
  title: string;
  source: string;
  children: React.ReactNode;
  fillHeight?: boolean;
}) {
  return (
    <section
      className={`rounded-xl border-2 border-[var(--pixel-shadow)] bg-[var(--pixel-panel)] p-4 min-w-0 overflow-hidden shadow-md ${fillHeight ? "flex flex-col min-h-0 h-full" : ""}`}
    >
      <h2 className="text-xs font-bold uppercase tracking-wide flex-shrink-0" style={{ color: "var(--pixel-text)" }}>{title}</h2>
      <p className="text-[10px] mb-2 flex-shrink-0" style={{ color: "var(--pixel-text-light)" }}>From your {source}</p>
      {fillHeight ? <div className="flex-1 min-h-0 flex flex-col">{children}</div> : children}
    </section>
  );
}
