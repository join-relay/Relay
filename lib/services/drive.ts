import "server-only"

import { google } from "googleapis"
import { getGoogleAccessToken, getGoogleOAuthClient } from "@/lib/services/google-auth"

export interface SelectedDriveFile {
  id: string
  name: string
  mimeType?: string
  webViewLink?: string
}

/** Fetch metadata for a Drive file by ID. Requires drive.file scope (app-created or user-selected). */
export async function getDriveFileMetadata(
  email: string | null | undefined,
  fileId: string
): Promise<SelectedDriveFile | null> {
  const accessToken = await getGoogleAccessToken(email)
  if (!accessToken) return null

  try {
    const drive = google.drive({
      version: "v3",
      auth: getGoogleOAuthClient(accessToken),
    })
    const res = await drive.files.get({
      fileId,
      fields: "id,name,mimeType,webViewLink",
    })
    return {
      id: res.data.id ?? fileId,
      name: res.data.name ?? "Untitled",
      mimeType: res.data.mimeType ?? undefined,
      webViewLink: res.data.webViewLink ?? undefined,
    }
  } catch {
    return null
  }
}
