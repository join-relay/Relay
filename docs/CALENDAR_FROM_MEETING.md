# Calendar-from-Meeting: Auto-Create Events from Meeting Discussion

This doc describes what’s needed to implement **automatic calendar creation** when someone says things like “let’s meet same time next week” in a meeting (e.g. while the Recall bot is recording).

## Goal

When the meeting ends and we have a transcript (and summary), detect **proposed new meetings** (e.g. “same time next week”, “follow-up Tuesday 3pm”) and either:

- **Option A:** Create Google Calendar events automatically (with a user setting to enable/disable).
- **Option B:** Show suggested events on the Meeting page for the user to **Approve / Edit / Reject** (like Actions), then create only the approved ones.

Option B is safer and recommended for v1.

---

## What Already Exists

| Piece | Status |
|-------|--------|
| **Google Calendar read** | ✅ `lib/services/calendar.ts`: `getLiveCalendarEvents`, `getUpcomingGoogleMeet`, `getConflictingEvents` |
| **Google Calendar write scope** | ✅ `GOOGLE_CALENDAR_WRITE_SCOPE` in `lib/services/google-auth.ts` and in `GOOGLE_BASE_SCOPES` (new sign-ins get it) |
| **Reschedule (patch) event** | ✅ `patchCalendarEvent(email, eventId, proposedStart, proposedEnd)` in `lib/services/calendar.ts` |
| **Create event** | ❌ Not implemented yet. Need `calendar.events.insert` (see below). |
| **Post-meeting data** | ✅ Recall webhook stores transcript + summary on the run. We have `transcriptEntries`, `summary`, and the **current meeting’s start/end** can be inferred from the run or from the Calendar event that was used to join. |

---

## 1. Create Calendar Event (API)

**Add a function in `lib/services/calendar.ts`:**

- **Name:** e.g. `createCalendarEvent(email, payload)`
- **Payload:** `{ title: string, start: string (ISO), end: string (ISO), description?: string, location?: string, calendarId?: string }`
- **Implementation:** Use the same pattern as `getLiveCalendarEvents` and `patchCalendarEvent`:
  - `getGoogleAccessToken(email)` for the user’s token.
  - `google.calendar({ version: "v3", auth: getGoogleOAuthClient(accessToken) })`.
  - `calendar.events.insert({ calendarId: calendarId ?? "primary", requestBody: { summary: title, start: { dateTime: start, timeZone: "UTC" }, end: { dateTime: end, timeZone: "UTC" }, description, location } })`.
- **Scopes:** Require `GOOGLE_CALENDAR_WRITE_SCOPE`. In `lib/services/google-auth.ts` you already expose `canReadCalendar`; add something like `canWriteCalendar: hasGrantedScope(scopes, GOOGLE_CALENDAR_WRITE_SCOPE)` and gate “create event” (and any “suggested events” UI) on that so users who haven’t reconnected since adding the scope get a “Reconnect Google to add calendar events” message.

**Optional:** Support creating a **Google Meet** for the new event (e.g. `conferenceDataVersion: 1` and `conferenceData.createRequest`) so the new event has a Meet link. Can be a follow-up.

---

## 2. Extract “Proposed Meetings” from Transcript / Summary

**New module (e.g. `lib/services/meeting-to-calendar.ts`):**

- **Input:** Transcript entries (and optionally the meeting summary), plus **reference time window** (the current meeting’s start/end so “same time next week” can be resolved).
- **Output:** List of **proposed events**: `{ title: string, start: string (ISO), end: string (ISO), confidence?: "high" | "medium" | "low", rawPhrase?: string }`.

**Implementation options:**

1. **LLM (recommended)**  
   - Send transcript (and/or summary) + “reference meeting: start X, end Y” to an LLM with a structured prompt + JSON output (or function-calling).  
   - Ask: “List any follow-up or new meetings agreed in this transcript (e.g. ‘same time next week’, ‘Tuesday 3pm’). For each, output title, start datetime (ISO), end datetime (ISO). Use the reference meeting’s time for relative phrases like ‘same time next week’.”  
   - Parse the model’s list and normalize to ISO start/end. Use a small, cheap model (e.g. `gpt-4o-mini`) to limit cost.

2. **Heuristic + LLM**  
   - Run a simple regex/heuristic over transcript lines for phrases like “meet same time next week”, “follow up next Tuesday”, “schedule for …”, then pass only those lines to the LLM to get start/end.  
   - Reduces token usage and keeps logic more predictable.

**Reference time:** When the Recall bot joins from our app, we have the **meeting URL** and often the **calendar event** that contained that Meet. So we can either:

- Store on the run the **event start/end** when we create the bot (e.g. from the upcoming Meet we resolved in meeting-readiness), or  
- Pass “today” + “current time” and let the LLM infer “same time next week” as next week same weekday + same time.

---

## 3. Where to Run This (Trigger)

**Option A – Inside Recall webhook (after summary):**

- In `app/api/webhooks/recall/route.ts`, when you handle `bot.done` / `bot.call_ended` you already:
  - Fetch recording URL, load run, generate summary, update run with `artifactMetadata` and `summary`.
- Add:
  1. Get reference meeting time (from run metadata or from the calendar event that was used to join; if not stored, use “now” and meeting length if available).
  2. Call `extractProposedMeetings(transcriptEntries, summary, referenceStart, referenceEnd)`.
  3. Store the list on the run, e.g. `proposedCalendarEvents: ProposedMeeting[]` (new field on `MeetingRunRecord`), **or** create “suggested actions” (see below) so they show on the Meeting or Actions page.

**Option B – Background / cron:**

- A job that runs periodically (or on a “Process meeting” button) finds runs with `status === "completed"` and no `proposedCalendarEvents` (or not yet processed), then runs extraction and stores results.  
- More flexible but adds infra (cron, queue, or manual trigger).

Recommendation: start with **Option A** in the webhook so that as soon as the meeting ends and the summary is ready, we have proposed events without extra triggers.

---

## 4. UX: Suggest vs Auto-Create

- **Suggest (recommended v1):**  
  - Persist proposed events as “suggested calendar events” (new type of surface, e.g. on Meeting page or a “Suggested events” card).  
  - Each item: title, start, end, “Add to calendar” / “Edit” / “Dismiss”.  
  - “Add to calendar” calls a new API (e.g. `POST /api/calendar/events`) that calls `createCalendarEvent(email, payload)` and then marks the suggestion as added (or remove it from the list).

- **Auto-create (optional later):**  
  - User setting, e.g. “Automatically add follow-up meetings from transcripts”.  
  - When enabled, after extraction, call `createCalendarEvent` for each proposed event (perhaps only `confidence === "high"`) and show a toast or note: “Added 2 events from the meeting.”

---

## 5. Data Model Additions

- **MeetingRunRecord** (in `types` and persistence):  
  - Optional field, e.g. `proposedCalendarEvents?: { title: string, start: string, end: string, confidence?: string, rawPhrase?: string }[]`.  
  - Filled by the webhook after extraction.

- **API:**  
  - `POST /api/calendar/events` (or under `/api/meeting/...`): body `{ title, start, end, description?, location? }`; requires session; calls `createCalendarEvent(session.user.email, body)`; returns `{ id, calendarId }`.

- **Google status:**  
  - Expose `canWriteCalendar` so the UI can show “Reconnect Google to add events from meetings” when the user hasn’t granted calendar write.

---

## 6. Summary Checklist

| Step | Action |
|------|--------|
| 1 | Add `createCalendarEvent(email, payload)` in `lib/services/calendar.ts` using `events.insert`. |
| 2 | Add `canWriteCalendar` (and optionally `canCreateCalendarEvents`) to Google integration status, gated on `GOOGLE_CALENDAR_WRITE_SCOPE`. |
| 3 | Add `lib/services/meeting-to-calendar.ts`: `extractProposedMeetings(transcript, summary, referenceStart, referenceEnd)` using an LLM (or heuristic + LLM) and return structured list. |
| 4 | In Recall webhook, after generating summary: get reference time from run (or default), call extraction, store `proposedCalendarEvents` on the run. |
| 5 | Extend Meeting page (or a new section): show “Suggested events from this meeting” from `activeRecallRun.proposedCalendarEvents` with Approve / Edit / Dismiss. |
| 6 | Add `POST /api/calendar/events` that creates an event and (if using suggestions) marks the suggestion as added. |
| 7 | (Optional) User setting to auto-create high-confidence events and/or optional Google Meet for new events. |

Once these are in place, a line like “let’s meet same time next week” in the transcript will produce a suggested event (or an automatic one if you add that setting) and the user can add it to their calendar in one click.
