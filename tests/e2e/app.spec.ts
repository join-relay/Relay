import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { expect, test, type Page } from "@playwright/test"

const GENERATED_DRAFTS_FILE = path.join(process.cwd(), ".relay", "generated-drafts.json")

type LiveDataState = {
  enabled: boolean
  displayName?: string
  gmailThreads?: Array<Record<string, unknown>>
  gmailThreadContexts?: Record<string, Record<string, unknown>>
  sentEmailSamples?: Array<Record<string, unknown>>
  calendarEvents?: Array<Record<string, unknown>>
}

async function setLiveData(page: Page, liveData?: LiveDataState) {
  const response = await page.request.post("/api/dev/test-auth", {
    data: { action: "setLiveData", liveData },
  })
  expect(response.ok()).toBeTruthy()
}

async function resetAndLogin(page: Page) {
  const resetResponse = await page.request.post("/api/dev/test-auth", {
    data: { action: "reset" },
  })
  expect(resetResponse.ok()).toBeTruthy()

  await page.goto("/api/dev/test-auth?action=login&redirectTo=/briefing")
  await expect(page).toHaveURL(/\/briefing$/)
}

async function seedGeneratedDrafts(store: Record<string, unknown>) {
  await mkdir(path.dirname(GENERATED_DRAFTS_FILE), { recursive: true })
  await writeFile(GENERATED_DRAFTS_FILE, JSON.stringify(store, null, 2), "utf8")
}

function createLiveReplyFixture() {
  const now = new Date()
  const start = new Date(now.getTime() + 60 * 60 * 1000)
  const end = new Date(start.getTime() + 30 * 60 * 1000)

  return {
    enabled: true,
    displayName: "Relay Dev User",
    gmailThreads: [
      {
        id: "thread-steve",
        messageId: "msg-steve-1",
        subject: "Budget follow-up",
        snippet: "Can you confirm the updated budget today?",
        from: "Steve <steve@example.com>",
        date: now.toISOString(),
        isUnread: true,
        labels: ["INBOX", "UNREAD"],
      },
    ],
    gmailThreadContexts: {
      "thread-steve": {
        threadId: "thread-steve",
        subject: "Budget follow-up",
        preview: "Hi Relay Dev User, can you confirm the updated budget today?",
        participants: ["Steve <steve@example.com>", "Relay Dev User <relay-dev@local.test>"],
        replyToMessageId: "<steve-thread-1@example.com>",
        referenceMessageIds: ["<steve-thread-1@example.com>"],
        messages: [
          {
            id: "msg-steve-1",
            from: "Steve <steve@example.com>",
            to: "Relay Dev User <relay-dev@local.test>",
            date: now.toISOString(),
            snippet: "Can you confirm the updated budget today?",
            bodyPreview:
              "Hi Relay Dev User,\n\nCan you confirm the updated budget today?\n\nBest,\nSteve",
            rfcMessageId: "<steve-thread-1@example.com>",
            referenceMessageIds: [],
          },
        ],
      },
    },
    sentEmailSamples: [
      {
        subject: "Sample one",
        snippet: "Happy to confirm.",
        bodyText:
          "Hi Jamie,\n\nHappy to confirm this works on my side.\n\nBest,\nRelay Dev User",
      },
      {
        subject: "Sample two",
        snippet: "Thanks again.",
        bodyText:
          "Hello Maya,\n\nThanks again for sending this over. I will follow up shortly.\n\nBest,\nRelay Dev User",
      },
      {
        subject: "Sample three",
        snippet: "Please let me know.",
        bodyText:
          "Hi Alex,\n\nPlease let me know if you need anything else from me.\n\nBest,\nRelay Dev User",
      },
    ],
    calendarEvents: [
      {
        id: "primary:event-budget-review",
        title: "Budget Review",
        start: start.toISOString(),
        end: end.toISOString(),
        provider: "google",
        isMeeting: true,
        meetingProvider: "google_meet",
        joinUrl: "https://meet.google.com/abc-defg-hij",
      },
    ],
  } satisfies LiveDataState
}

function createQuotedThreadFixture() {
  const now = new Date()

  return {
    enabled: true,
    displayName: "Relay Dev User",
    gmailThreads: [
      {
        id: "thread-terraria",
        messageId: "msg-terraria-1",
        subject: "Re: Terraria night",
        snippet: "Are you still up for Terraria this weekend?",
        from: "Alex <alex@example.com>",
        date: now.toISOString(),
        isUnread: true,
        labels: ["INBOX", "UNREAD"],
      },
    ],
    gmailThreadContexts: {
      "thread-terraria": {
        threadId: "thread-terraria",
        subject: "Re: Terraria night",
        preview: "Hey, are you still up for Terraria this weekend?",
        participants: ["Alex <alex@example.com>", "Relay Dev User <relay-dev@local.test>"],
        replyToMessageId: "<terraria-thread-1@example.com>",
        referenceMessageIds: ["<terraria-thread-1@example.com>"],
        messages: [
          {
            id: "msg-terraria-1",
            from: "Alex <alex@example.com>",
            to: "Relay Dev User <relay-dev@local.test>",
            date: now.toISOString(),
            snippet: "Are you still up for Terraria this weekend?",
            bodyPreview:
              "Hey Relay Dev User,\n\nAre you still up for Terraria this weekend?\n\nOn Tue, someone wrote:\nA-16 drafts are attached for review.\n\nBest,\nAlex",
            rfcMessageId: "<terraria-thread-1@example.com>",
            referenceMessageIds: [],
          },
        ],
      },
    },
    sentEmailSamples: [
      {
        subject: "Sample one",
        snippet: "Happy to confirm.",
        bodyText:
          "Hi Jamie,\n\nHappy to confirm this works on my side.\n\nBest,\nRelay Dev User",
      },
      {
        subject: "Sample two",
        snippet: "Thanks again.",
        bodyText:
          "Hello Maya,\n\nThanks again for sending this over. I will follow up shortly.\n\nBest,\nRelay Dev User",
      },
      {
        subject: "Sample three",
        snippet: "Please let me know.",
        bodyText:
          "Hi Alex,\n\nPlease let me know if you need anything else from me.\n\nBest,\nRelay Dev User",
      },
    ],
    calendarEvents: [],
  } satisfies LiveDataState
}

test("loads briefing and navigates to actions on first click", async ({ page }) => {
  await resetAndLogin(page)

  await expect(page.getByTestId("sidebar-briefing")).toBeVisible()
  await page.getByTestId("sidebar-actions").click()
  await expect(page).toHaveURL(/\/actions$/)
  await expect(page.getByTestId("action-card-a1")).toBeVisible()
})

test("rejected action disappears from Actions list and stays gone after navigation and refresh", async ({
  page,
}) => {
  await resetAndLogin(page)

  await page.getByTestId("sidebar-actions").click()
  await expect(page).toHaveURL(/\/actions$/)

  const actionCard = page.getByTestId("action-card-a1")
  await expect(actionCard).toBeVisible()
  await actionCard.getByRole("button", { name: "Reject" }).click()
  await expect(actionCard).not.toBeVisible({ timeout: 5000 })

  await page.getByTestId("sidebar-briefing").click()
  await expect(page).toHaveURL(/\/briefing$/)
  await page.getByTestId("sidebar-actions").click()
  await expect(page).toHaveURL(/\/actions$/)
  await expect(page.getByTestId("action-card-a1")).not.toBeVisible()

  await page.reload()
  await expect(page.getByTestId("action-card-a1")).not.toBeVisible()
})

test.skip("opens settings and logs out in dev test mode", async ({ page }) => {
  // Skip: logout redirect uses NEXTAUTH_URL; when that differs from e2e baseURL (3100) we get
  // ERR_CONNECTION_REFUSED. Run with NEXTAUTH_URL=http://localhost:3100 to enable this test.
  await resetAndLogin(page)

  await page.goto("/settings")
  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible()

  await page.getByRole("button", { name: "Log out" }).click()
  await page.waitForURL((u) => u.pathname === "/login" || u.pathname.includes("signout"), {
    timeout: 10000,
  })
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByTestId("dev-test-login")).toBeVisible()
})

test("meeting page resolves to an explicit state without indefinite loading", async ({ page }) => {
  await resetAndLogin(page)
  await setLiveData(page, {
    ...createLiveReplyFixture(),
    calendarEvents: [],
  })

  await page.goto("/meeting")
  await expect(page.getByTestId("meeting-resolution-state")).toContainText("empty")
  await expect(page.getByText("Loading Google meeting readiness...")).not.toBeVisible()
})

test("Recall readiness is reported on Meeting page and matches status route", async ({ page }) => {
  await resetAndLogin(page)
  await page.goto("/meeting")
  await expect(page.getByText(/Recall/i)).toBeVisible({ timeout: 10000 })
  const statusRes = await page.request.get("/api/meeting/status")
  expect(statusRes.ok()).toBeTruthy()
  const status = await statusRes.json()
  expect(status.providerReadiness).toBeDefined()
  expect(status.providerReadiness.provider).toBe("recall_ai")
  expect(["configured", "not_configured"]).toContain(status.providerReadiness.configState)
  const stateText =
    status.providerReadiness.configState === "not_configured"
      ? "not configured"
      : "configured"
  await expect(page.getByText(new RegExp(stateText, "i"))).toBeVisible()
})

test("approve removes action from list promptly", async ({ page }) => {
  await resetAndLogin(page)
  await page.goto("/actions")
  const actionCard = page.getByTestId("action-card-a1")
  await expect(actionCard).toBeVisible()
  await actionCard.getByRole("button", { name: /Approve & execute/i }).click()
  await expect(actionCard).not.toBeVisible({ timeout: 8000 })
})

test("sidebar navigation works on first click", async ({ page }) => {
  await resetAndLogin(page)
  await expect(page).toHaveURL(/\/briefing$/)
  await page.getByTestId("sidebar-actions").click()
  await expect(page).toHaveURL(/\/actions$/)
  await page.getByTestId("sidebar-meeting").click()
  await expect(page).toHaveURL(/\/meeting$/)
  await page.getByTestId("sidebar-briefing").click()
  await expect(page).toHaveURL(/\/briefing$/)
})

test("dev provider-readiness route returns presence only when not in production", async ({ page }) => {
  const res = await page.request.get("/api/dev/provider-readiness")
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  expect(body.recallPresence).toBeDefined()
  expect(typeof body.recallPresence.RECALL_API_KEY).toBe("boolean")
  expect(typeof body.recallPresence.RECALL_API_BASE_URL).toBe("boolean")
  expect(typeof body.recallPresence.RECALL_WEBHOOK_SECRET).toBe("boolean")
  expect(body.note).toBeDefined()
})

test("generated replies keep sender and recipient identity correct", async ({ page }) => {
  await resetAndLogin(page)
  await setLiveData(page, createLiveReplyFixture())

  await page.goto("/actions")

  const actionCard = page.getByTestId("action-card-gmail:thread-steve")
  await expect(actionCard).toBeVisible()
  await actionCard.getByRole("button", { name: "Generate reply" }).click()

  const draftBody = actionCard.getByTestId("draft-email-body")
  await expect(draftBody).not.toHaveText("")
  await expect(draftBody).toContainText("Hi Steve,")
  await expect(draftBody).toContainText("Relay Dev User")
  expect(
    await draftBody.textContent()
  ).toMatch(/(Best|Best regards),?\s*\n?\s*Relay Dev User/i)
  await expect(draftBody).not.toContainText("Best,\nBest,")
  await expect(draftBody).not.toContainText("Hi Relay Dev User,")
  await expect(draftBody).not.toContainText("Best,\nSteve")
})

test("signature override from settings is used in generated replies", async ({ page }) => {
  await resetAndLogin(page)
  await setLiveData(page, createLiveReplyFixture())

  await page.goto("/settings")
  await page.getByTestId("signature-override-input").fill(
    "Best regards,\nRelay Dev User\nChief of Staff"
  )
  await page.getByTestId("save-preferences").click()

  await page.goto("/actions")
  const actionCard = page.getByTestId("action-card-gmail:thread-steve")
  await expect(actionCard).toBeVisible()
  await actionCard.getByRole("button", { name: "Generate reply" }).click()

  const draftBody = actionCard.getByTestId("draft-email-body")
  await expect(draftBody).not.toHaveText("")
  await expect(draftBody).toContainText("Chief of Staff")
  await expect(draftBody).toContainText("Best regards,\nRelay Dev User\nChief of Staff")
  await expect(draftBody).not.toContainText("Best,\nBest regards,")
})

test("live inbox notifications fire once for a new message in an existing thread", async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as typeof window & {
      __relayNotificationEvents?: { browser: number; audio: number }
    }).__relayNotificationEvents = { browser: 0, audio: 0 }

    class MockNotification {
      static permission: NotificationPermission = "granted"

      static requestPermission() {
        return Promise.resolve("granted" as NotificationPermission)
      }

      constructor() {
        const state = (window as typeof window & {
          __relayNotificationEvents: { browser: number; audio: number }
        }).__relayNotificationEvents
        state.browser += 1
      }

      close() {}
    }

    class MockAudioContext {
      currentTime = 0
      destination = {}

      createOscillator() {
        return {
          type: "sine",
          frequency: { setValueAtTime() {} },
          connect() {},
          start() {},
          stop() {},
        }
      }

      createGain() {
        return {
          gain: {
            setValueAtTime() {},
            exponentialRampToValueAtTime() {},
          },
          connect() {},
        }
      }

      close() {
        const state = (window as typeof window & {
          __relayNotificationEvents: { browser: number; audio: number }
        }).__relayNotificationEvents
        state.audio += 1
        return Promise.resolve()
      }
    }

    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: MockNotification,
    })
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: MockAudioContext,
    })
  })

  await resetAndLogin(page)
  await setLiveData(page, {
    ...createLiveReplyFixture(),
    gmailThreads: [
      {
        id: "thread-steve",
        messageId: "msg-steve-1",
        subject: "Budget follow-up",
        snippet: "Can you confirm the updated budget today?",
        from: "Steve <steve@example.com>",
        date: new Date().toISOString(),
        isUnread: true,
        labels: ["INBOX", "UNREAD"],
      },
    ],
  })

  await page.goto("/briefing")
  await page.mouse.click(10, 10)

  await setLiveData(page, {
    ...createLiveReplyFixture(),
    gmailThreads: [
      {
        id: "thread-steve",
        messageId: "msg-steve-2",
        subject: "Budget follow-up",
        snippet: "Following up on this today.",
        from: "Steve <steve@example.com>",
        date: new Date(Date.now() + 60_000).toISOString(),
        isUnread: true,
        labels: ["INBOX", "UNREAD"],
      },
    ],
    gmailThreadContexts: {
      "thread-steve": {
        threadId: "thread-steve",
        subject: "Budget follow-up",
        preview: "Hi Relay Dev User, following up on this today.",
        participants: ["Steve <steve@example.com>", "Relay Dev User <relay-dev@local.test>"],
        replyToMessageId: "<steve-thread-2@example.com>",
        referenceMessageIds: ["<steve-thread-1@example.com>", "<steve-thread-2@example.com>"],
        messages: [
          {
            id: "msg-steve-1",
            from: "Steve <steve@example.com>",
            to: "Relay Dev User <relay-dev@local.test>",
            date: new Date().toISOString(),
            snippet: "Can you confirm the updated budget today?",
            bodyPreview:
              "Hi Relay Dev User,\n\nCan you confirm the updated budget today?\n\nBest,\nSteve",
            rfcMessageId: "<steve-thread-1@example.com>",
            referenceMessageIds: [],
          },
          {
            id: "msg-steve-2",
            from: "Steve <steve@example.com>",
            to: "Relay Dev User <relay-dev@local.test>",
            date: new Date(Date.now() + 60_000).toISOString(),
            snippet: "Following up on this today.",
            bodyPreview:
              "Hi Relay Dev User,\n\nFollowing up on this today.\n\nBest,\nSteve",
            rfcMessageId: "<steve-thread-2@example.com>",
            referenceMessageIds: ["<steve-thread-1@example.com>"],
          },
        ],
      },
    },
  })

  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await expect(page.getByTestId("live-inbox-toast")).toContainText("New email from Steve")
  await page.waitForTimeout(400)
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & {
              __relayNotificationEvents: { browser: number; audio: number }
            }
          ).__relayNotificationEvents
      )
    )
    .toEqual({ browser: 1, audio: 1 })

  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await page.waitForTimeout(400)
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & {
              __relayNotificationEvents: { browser: number; audio: number }
            }
          ).__relayNotificationEvents
      )
    )
    .toEqual({ browser: 1, audio: 1 })
})

test("quoted older thread content does not hijack the reply topic", async ({ page }) => {
  await resetAndLogin(page)
  await setLiveData(page, createQuotedThreadFixture())

  await page.goto("/actions")

  const actionCard = page.getByTestId("action-card-gmail:thread-terraria")
  await expect(actionCard).toBeVisible()
  await actionCard.getByRole("button", { name: "Generate reply" }).click()

  const draftBody = actionCard.getByTestId("draft-email-body")
  await expect(draftBody).toContainText("Terraria")
  await expect(draftBody).not.toContainText("minutes")
  await expect(draftBody).not.toContainText("A-16")
  await expect(draftBody).not.toContainText("drafts are attached")
})

test("stale cached bad drafts are invalidated before display and regeneration", async ({ page }) => {
  await resetAndLogin(page)
  await setLiveData(page, createQuotedThreadFixture())
  await seedGeneratedDrafts({
    "relay-dev@local.test": {
      "gmail:thread-terraria": {
        actionId: "gmail:thread-terraria",
        userEmail: "relay-dev@local.test",
        threadId: "thread-terraria",
        cacheKey: "legacy-bad-cache-key",
        body:
          "Hi Alex,\n\nThanks for the note and for sharing the minutes. I can do a design review for the A-16 drafts.\n\nBest,\nRelay Dev User",
        generation: {
          source: "openai",
          finalDraftSource: "cached_generated_draft",
          cacheStatus: "generated",
          generatedAt: new Date().toISOString(),
          model: "gpt-4o-mini",
          openAIConfigured: true,
          attemptedOpenAI: true,
          usedOriginalThreadContext: true,
          usedSentMailStyle: true,
          usedSavedSettings: true,
          styleSampleCount: 3,
          note: "Legacy cached draft for regression coverage.",
        },
        updatedAt: new Date().toISOString(),
      },
    },
  })

  await page.goto("/actions")

  const actionCard = page.getByTestId("action-card-gmail:thread-terraria")
  await expect(actionCard).toBeVisible()
  await expect(actionCard.getByText("Generate reply")).toBeVisible()
  await expect(actionCard).not.toContainText("A-16 drafts")
  await expect(actionCard).not.toContainText("sharing the minutes")

  await actionCard.getByRole("button", { name: "Generate reply" }).click()

  const draftBody = actionCard.getByTestId("draft-email-body")
  await expect(draftBody).toContainText("Terraria")
  await expect(draftBody).not.toContainText("A-16")
  await expect(draftBody).not.toContainText("minutes")
})
