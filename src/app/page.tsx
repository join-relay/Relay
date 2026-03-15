"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function HomePage() {
  const [auth, setAuth] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => setAuth(d.authenticated))
      .catch(() => setAuth(false));
  }, []);

  const error = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("error") : null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: "var(--pixel-bg)" }}>
      <div
        className="max-w-xl w-full rounded-xl border-2 border-[var(--pixel-border)] p-8 text-center shadow-lg"
        style={{ background: "var(--pixel-panel)", boxShadow: "6px 6px 0 var(--pixel-border)" }}
      >
        <h1 className="text-sm sm:text-base font-bold uppercase tracking-wide mb-2" style={{ color: "var(--pixel-text)" }}>
          Work-Life & Wellbeing
        </h1>
        <p className="text-[10px] mb-6 leading-relaxed" style={{ color: "var(--pixel-text-light)" }}>
          Connect Outlook or G Suite to see your calendar and email, then track how you feel.
        </p>
        {error === "no_code" && (
          <p className="text-[10px] mb-4" style={{ color: "var(--pixel-hp)" }}>Sign-in was cancelled or no code received.</p>
        )}
        {error === "auth_failed" && (
          <p className="text-[10px] mb-4" style={{ color: "var(--pixel-hp)" }}>Sign-in failed. Check your app credentials in .env.local.</p>
        )}
        {auth === null && <p className="text-[10px]" style={{ color: "var(--pixel-text-light)" }}>Checking sign-in…</p>}
        {auth === true && (
          <Link
            href="/dashboard"
            className="inline-block px-4 py-2 border-2 border-[var(--pixel-border)] text-xs font-bold uppercase mt-2"
            style={{ background: "var(--pixel-panel-dark)", color: "var(--pixel-highlight)" }}
          >
            Go to Dashboard
          </Link>
        )}
        {auth === false && (
          <>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch w-full sm:max-w-md mx-auto">
              <Link
                href="/api/auth/microsoft"
                className="inline-flex items-center justify-center min-h-[48px] px-5 py-3 rounded-lg text-xs font-bold uppercase text-center text-white transition-opacity hover:opacity-90"
                style={{ background: "#00a4ef" }}
              >
                Sign in with Microsoft (Outlook)
              </Link>
              <Link
                href="/api/auth/google"
                className="inline-flex items-center justify-center min-h-[48px] px-5 py-3 rounded-lg text-xs font-bold uppercase text-center text-white transition-opacity hover:opacity-90"
                style={{ background: "#4285F4" }}
              >
                Sign in with Google (G Suite)
              </Link>
            </div>
            <Link
              href="/dashboard?demo=true"
              className="inline-block mt-4 text-[10px] uppercase tracking-wider underline hover:no-underline"
              style={{ color: "var(--pixel-text-light)" }}
            >
              See demo
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
