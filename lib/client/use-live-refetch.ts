"use client"

import { useEffect } from "react"

export function useLiveRefetch(refetch: () => void | Promise<unknown>) {
  useEffect(() => {
    const triggerRefetch = () => {
      void refetch()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        triggerRefetch()
      }
    }

    window.addEventListener("focus", triggerRefetch)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("focus", triggerRefetch)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [refetch])
}
