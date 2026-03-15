"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Dashboard from "@/components/Dashboard";
import WellbeingCheckIn from "@/components/WellbeingCheckIn";
import ProfileOverview from "@/components/ProfileOverview";
import { getDemoContext } from "@/lib/demo-context";
import type { WorkLifeContext } from "@/types/context";

type Provider = "google" | "microsoft" | undefined;

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const isDemo = searchParams.get("demo") === "true";

  const [context, setContext] = useState<WorkLifeContext | null | "loading">("loading");
  const [auth, setAuth] = useState<boolean | null>(null);
  const [provider, setProvider] = useState<Provider>(undefined);

  function refresh() {
    if (isDemo) {
      setContext(getDemoContext());
      return;
    }
    setContext("loading");
    fetch("/api/context")
      .then((r) => r.json())
      .then((d) => {
        setContext(d.context || null);
        setProvider(d.provider);
      })
      .catch(() => setContext(null));
  }

  useEffect(() => {
    if (isDemo) {
      setAuth(true); // treat as "viewing" so we don't show sign-in
      setContext(getDemoContext());
      setProvider(undefined);
      return;
    }
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => {
        setAuth(d.authenticated);
        setProvider(d.provider);
        if (d.authenticated) refresh();
        else setContext(null);
      })
      .catch(() => {
        setAuth(false);
        setContext(null);
      });
  }, [isDemo]);

  if (auth === false && !isDemo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--pixel-bg)" }}>
        <div className="text-center rounded-xl border-2 border-[var(--pixel-shadow)] bg-[var(--pixel-panel)] p-6 shadow-md">
          <p className="text-xs mb-4" style={{ color: "var(--pixel-text)" }}>You need to sign in first.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/api/auth/microsoft"
              className="inline-block px-3 py-1.5 border-2 border-[var(--pixel-border)] text-xs font-bold uppercase"
              style={{ background: "#2f2f2f", color: "#fff" }}
            >
              Sign in with Microsoft (Outlook)
            </Link>
            <Link
              href="/api/auth/google"
              className="inline-block px-3 py-1.5 border-2 border-[var(--pixel-border)] text-xs font-bold uppercase"
              style={{ background: "var(--pixel-panel-dark)", color: "var(--pixel-highlight)" }}
            >
              Sign in with Google (G Suite)
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--pixel-bg)" }}>
      {isDemo && (
        <div
          className="border-b border-[var(--pixel-shadow)] px-4 py-2 text-center text-[10px] uppercase tracking-wider bg-[var(--pixel-highlight)] text-white"
        >
          Demo — sample data. Sign in with Google or Microsoft to use your real calendar and email.
        </div>
      )}
      <header
        className="border-b-2 border-[var(--pixel-shadow)] px-4 md:px-8 py-3 flex items-center justify-between bg-[var(--pixel-panel-dark)]"
      >
        <h1 className="text-xs sm:text-sm font-bold uppercase tracking-wide" style={{ color: "var(--pixel-highlight)" }}>
          Work-Life & Wellbeing
        </h1>
        <div className="flex items-center gap-2 text-[10px] sm:text-xs">
          {!isDemo && (
            <button
              onClick={refresh}
              disabled={context === "loading"}
              className="px-2 py-1 rounded-lg border border-[var(--pixel-shadow)] bg-[var(--pixel-panel)] text-[var(--pixel-text)] hover:bg-[var(--pixel-highlight)]/20 disabled:opacity-50 transition-colors"
            >
              Refresh
            </button>
          )}
          <Link
            href="/"
            className="px-2 py-1 rounded-lg border border-[var(--pixel-shadow)] bg-[var(--pixel-panel)] text-[var(--pixel-text)] hover:bg-[var(--pixel-highlight)]/20"
          >
            {isDemo ? "Exit demo" : "Home"}
          </Link>
          {!isDemo && (
            <button
              type="button"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/";
              }}
              className="px-2 py-1 rounded-lg border border-[var(--pixel-shadow)] bg-[var(--pixel-panel)] text-[var(--pixel-stress)] hover:bg-[var(--pixel-stress)]/10 transition-colors"
            >
              Sign out
            </button>
          )}
        </div>
      </header>
      <main className="w-full max-w-[1600px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8 space-y-6">
        <ProfileOverview context={context} />
        {isDemo ? (
          <p className="text-[10px] text-center py-2" style={{ color: "var(--pixel-text-light)" }}>
            Sign in with Google or Microsoft to log wellbeing check-ins and sync your real data.
          </p>
        ) : (
          <WellbeingCheckIn onSubmitted={refresh} />
        )}
        <Dashboard context={context} provider={provider} onSync={refresh} isDemo={isDemo} />
      </main>
    </div>
  );
}
