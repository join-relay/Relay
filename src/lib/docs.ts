import { drive_v3, docs_v1, google } from "googleapis";
import type { DocSummary } from "@/types/context";

const RECENT_DOCS_N = 15;
const MAX_COMMENTS_PAGE = 20;

function extractTextFromDoc(doc: docs_v1.Schema$Document): string {
  const body = doc.body?.content;
  if (!body) return "";
  const parts: string[] = [];
  const sectionTitles: string[] = [];

  for (const el of body) {
    if (el.paragraph?.elements) {
      for (const run of el.paragraph.elements) {
        if (run.textRun?.content) {
          parts.push(run.textRun.content);
        }
      }
    }
    if (el.paragraph?.paragraphStyle?.namedStyleType?.startsWith("HEADING")) {
      const text = el.paragraph?.elements?.map((e) => e.textRun?.content || "").join("").trim();
      if (text) sectionTitles.push(text);
    }
  }

  return parts.join("").slice(0, 3000);
}

export async function syncDocs(auth: drive_v3.Options["auth"]): Promise<DocSummary[]> {
  const drive = google.drive({ version: "v3", auth });
  const docsApi = google.docs({ version: "v1", auth });

  const listRes = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.document' and trashed = false",
    orderBy: "modifiedTime desc",
    pageSize: RECENT_DOCS_N,
    fields: "files(id, name, modifiedTime, owners)",
  });

  const files = listRes.data.files || [];
  const syncedAt = new Date().toISOString();
  const results: DocSummary[] = [];

  for (const file of files) {
    const fileId = file.id!;
    const name = file.name || "Untitled";
    const lastModified = file.modifiedTime || syncedAt;
    const owners = (file.owners || []).map((o) => o.displayName || o.emailAddress || "").filter(Boolean);

    let extractedText: string | undefined;
    let sectionTitles: string[] | undefined;
    let commentsCount = 0;
    let lastRevised: string | undefined;

    try {
      const docRes = await docsApi.documents.get({ documentId: fileId });
      const doc = docRes.data;
      extractedText = extractTextFromDoc(doc);
      const body = doc.body?.content;
      if (body) {
        const titles: string[] = [];
        for (const el of body) {
          if (el.paragraph?.paragraphStyle?.namedStyleType?.startsWith("HEADING")) {
            const t = el.paragraph?.elements?.map((e) => e.textRun?.content || "").join("").trim();
            if (t) titles.push(t);
          }
        }
        if (titles.length) sectionTitles = titles;
      }
    } catch {
      // Skip content if no access or error
    }

    try {
      const commentsRes = await drive.comments.list({
        fileId,
        pageSize: MAX_COMMENTS_PAGE,
        fields: "comments(id)",
      });
      commentsCount = (commentsRes.data.comments || []).length;
    } catch {
      // Ignore
    }

    try {
      const revRes = await drive.revisions.list({
        fileId,
        pageSize: 1,
        fields: "revisions(modifiedTime)",
      });
      const revs = revRes.data.revisions || [];
      if (revs[0]?.modifiedTime) lastRevised = revs[0].modifiedTime;
    } catch {
      // Ignore
    }

    results.push({
      id: fileId,
      name,
      lastModified,
      owners,
      extractedText,
      sectionTitles,
      commentsCount,
      lastRevised,
      sourceId: fileId,
      syncedAt,
    });
  }

  return results;
}
