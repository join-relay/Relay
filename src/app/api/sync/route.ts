import { NextResponse } from "next/server";
import { getValidAuthClient } from "@/lib/google-auth";
import { getValidMicrosoftAccessToken } from "@/lib/microsoft-auth";
import { syncGmail } from "@/lib/gmail";
import { syncCalendar } from "@/lib/calendar";
import { syncDocs } from "@/lib/docs";
import { syncOutlook } from "@/lib/outlook";
import { syncMicrosoftCalendar } from "@/lib/calendar-microsoft";
import { saveContextStore, loadContextStore, getProvider } from "@/lib/store";

export async function POST() {
  const provider = getProvider();
  if (!provider) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  try {
    if (provider === "google") {
      const auth = await getValidAuthClient();
      if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      const [emailMessages, calendarEvents, docSummaries] = await Promise.all([
        syncGmail(auth),
        syncCalendar(auth),
        syncDocs(auth),
      ]);
      const store = loadContextStore();
      store.lastSyncedAt = new Date().toISOString();
      store.calendarEvents = calendarEvents;
      store.emailMessages = emailMessages;
      store.docSummaries = docSummaries;
      saveContextStore(store);
      return NextResponse.json({
        ok: true,
        provider: "google",
        lastSyncedAt: store.lastSyncedAt,
        calendarCount: calendarEvents.length,
        emailCount: emailMessages.length,
        docsCount: docSummaries.length,
      });
    } else {
      const accessToken = await getValidMicrosoftAccessToken();
      if (!accessToken) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      const [emailMessages, calendarEvents] = await Promise.all([
        syncOutlook(accessToken),
        syncMicrosoftCalendar(accessToken),
      ]);
      const store = loadContextStore();
      store.lastSyncedAt = new Date().toISOString();
      store.calendarEvents = calendarEvents;
      store.emailMessages = emailMessages;
      store.docSummaries = [];
      saveContextStore(store);
      return NextResponse.json({
        ok: true,
        provider: "microsoft",
        lastSyncedAt: store.lastSyncedAt,
        calendarCount: calendarEvents.length,
        emailCount: emailMessages.length,
        docsCount: 0,
      });
    }
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 500 }
    );
  }
}
