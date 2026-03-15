"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ACTIONS_QUERY_KEY,
  BRIEFING_QUERY_KEY,
  LIVE_REFRESH_INTERVAL_MS,
  fetchBriefing,
} from "@/lib/client/dashboard-queries"
import { useLiveRefetch } from "@/lib/client/use-live-refetch"
import type { RelayCustomizationSettings } from "@/types"

type NotificationPrefs = Pick<
  RelayCustomizationSettings,
  "enableBrowserNotifications" | "enableNotificationSound"
>

type ToastState = {
  id: string
  title: string
  body: string
}

const MAX_SEEN_THREAD_IDS = 200
const MAX_TOASTS = 3

function getStorageKey(email: string) {
  return `relay:seen-gmail-threads:${email.trim().toLowerCase()}`
}

function getThreadNotificationKey(thread: {
  id: string
  messageId?: string
  date: string
  from: string
  subject: string
}) {
  return (
    thread.messageId ||
    `${thread.id}:${thread.date}:${thread.from.trim().toLowerCase()}:${thread.subject.trim().toLowerCase()}`
  )
}

function readSeenThreadIds(storageKey: string) {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is string => typeof value === "string")
  } catch {
    return []
  }
}

function writeSeenThreadIds(storageKey: string, values: Iterable<string>) {
  const next = Array.from(new Set(values)).slice(-MAX_SEEN_THREAD_IDS)
  window.localStorage.setItem(storageKey, JSON.stringify(next))
}

function showBrowserNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return
  if (Notification.permission !== "granted") return

  try {
    const notification = new Notification(title, { body, tag: "relay-new-email" })
    window.setTimeout(() => notification.close(), 5000)
  } catch {
    // Ignore browser notification failures and keep the in-app toast path.
  }
}

function playNotificationSound() {
  if (typeof window === "undefined") return
  const AudioContextCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextCtor) return

  try {
    const audioContext = new AudioContextCtor()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.type = "sine"
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime)
    gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.035, audioContext.currentTime + 0.02)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.25)

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    oscillator.start()
    oscillator.stop(audioContext.currentTime + 0.25)

    window.setTimeout(() => {
      void audioContext.close().catch(() => undefined)
    }, 350)
  } catch {
    // Ignore audio failures so notifications still work without sound.
  }
}

export function LiveInboxNotifier({
  userEmail,
  preferences,
}: {
  userEmail: string
  preferences: NotificationPrefs
}) {
  const queryClient = useQueryClient()
  const [toasts, setToasts] = useState<ToastState[]>([])
  const [isPermissionPromptDismissed, setIsPermissionPromptDismissed] = useState(false)
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"
  )
  const seenIdsRef = useRef<Set<string>>(new Set())
  const isPrimedRef = useRef(false)
  const lastSignatureRef = useRef<string | null>(null)
  const hasUserInteractedRef = useRef(false)
  const storageKey = useMemo(() => getStorageKey(userEmail), [userEmail])

  useEffect(() => {
    if (typeof window === "undefined") return

    const seenIds = readSeenThreadIds(storageKey)
    seenIdsRef.current = new Set(seenIds)
    isPrimedRef.current = seenIds.length > 0
    setBrowserPermission("Notification" in window ? Notification.permission : "unsupported")
  }, [storageKey])

  useEffect(() => {
    if (typeof window === "undefined") return

    const markInteracted = () => {
      hasUserInteractedRef.current = true
    }

    window.addEventListener("pointerdown", markInteracted, { once: true })
    window.addEventListener("keydown", markInteracted, { once: true })

    return () => {
      window.removeEventListener("pointerdown", markInteracted)
      window.removeEventListener("keydown", markInteracted)
    }
  }, [])

  const { data, refetch } = useQuery({
    queryKey: BRIEFING_QUERY_KEY,
    queryFn: fetchBriefing,
    staleTime: 10000,
    refetchInterval: LIVE_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  })

  useLiveRefetch(refetch)

  useEffect(() => {
    if (!data || data.source !== "google") return

    const threadSignature = data.inboxSummary.threads
      .map((thread) => `${getThreadNotificationKey(thread)}:${thread.isUnread ? "u" : "r"}`)
      .join("|")

    if (threadSignature && lastSignatureRef.current && threadSignature !== lastSignatureRef.current) {
      void queryClient.invalidateQueries({ queryKey: ACTIONS_QUERY_KEY })
    }

    lastSignatureRef.current = threadSignature
  }, [data, queryClient])

  useEffect(() => {
    if (typeof window === "undefined" || !data || data.source !== "google") return

    const liveThreads = data.inboxSummary.threads.filter((thread) => thread.id)
    if (liveThreads.length === 0) return
    const liveKeys = liveThreads.map((thread) => getThreadNotificationKey(thread))

    if (!isPrimedRef.current) {
      liveKeys.forEach((key) => seenIdsRef.current.add(key))
      writeSeenThreadIds(storageKey, seenIdsRef.current)
      isPrimedRef.current = true
      return
    }

    const incoming = liveThreads.filter(
      (thread) => !seenIdsRef.current.has(getThreadNotificationKey(thread))
    )
    if (incoming.length === 0) return

    incoming.forEach((thread) => seenIdsRef.current.add(getThreadNotificationKey(thread)))
    writeSeenThreadIds(storageKey, seenIdsRef.current)

    const newest = incoming[0]
    const title =
      incoming.length === 1 ? `New email from ${newest.from}` : `${incoming.length} new emails`
    const body =
      incoming.length === 1
        ? newest.subject || newest.snippet || "A new Gmail thread arrived."
        : incoming
            .slice(0, 2)
            .map((thread) => thread.subject)
            .filter(Boolean)
            .join(" • ") || "New Gmail threads arrived."

    setToasts((current) =>
      [{ id: crypto.randomUUID(), title, body }, ...current].slice(0, MAX_TOASTS)
    )

    if (preferences.enableBrowserNotifications) {
      showBrowserNotification(title, body)
    }

    if (preferences.enableNotificationSound && hasUserInteractedRef.current) {
      playNotificationSound()
    }

    void queryClient.invalidateQueries({ queryKey: ACTIONS_QUERY_KEY })
  }, [data, preferences.enableBrowserNotifications, preferences.enableNotificationSound, queryClient, storageKey])

  const showPermissionPrompt =
    data?.source === "google" &&
    preferences.enableBrowserNotifications &&
    browserPermission === "default" &&
    !isPermissionPromptDismissed

  async function requestBrowserPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setBrowserPermission("unsupported")
      return
    }

    const permission = await Notification.requestPermission()
    setBrowserPermission(permission)
    if (permission !== "default") {
      setIsPermissionPromptDismissed(true)
    }
  }

  useEffect(() => {
    if (toasts.length === 0) return

    const timeout = window.setTimeout(() => {
      setToasts((current) => current.slice(0, -1))
    }, 5000)

    return () => window.clearTimeout(timeout)
  }, [toasts])

  return (
    <div className="pointer-events-none fixed right-6 top-20 z-40 flex w-full max-w-sm flex-col gap-3">
      {showPermissionPrompt && (
        <div
          data-testid="notification-permission-prompt"
          className="pointer-events-auto rounded-relay-card border border-[var(--border)] bg-white/95 p-4 shadow-relay-elevated"
        >
          <p className="text-sm font-medium text-[#1B2E3B]">Enable browser alerts for new email</p>
          <p className="mt-1 text-sm text-[#3F5363]">
            Relay can notify you when new Gmail threads arrive while you stay in the app.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void requestBrowserPermission()}
              className="rounded-relay-control bg-[#213443] px-3 py-1.5 text-xs font-medium text-white transition-smooth hover:bg-[#1B2E3B]"
            >
              Enable
            </button>
            <button
              type="button"
              onClick={() => setIsPermissionPromptDismissed(true)}
              className="rounded-relay-control border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[#1B2E3B] transition-smooth hover:bg-[#e8edf3]"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {toasts.map((toast) => (
        <div
          key={toast.id}
          data-testid="live-inbox-toast"
          className="pointer-events-auto rounded-relay-card border border-[var(--border)] bg-white/95 p-4 shadow-relay-elevated"
        >
          <p className="text-sm font-medium text-[#1B2E3B]">{toast.title}</p>
          <p className="mt-1 text-sm text-[#3F5363]">{toast.body}</p>
        </div>
      ))}
    </div>
  )
}
