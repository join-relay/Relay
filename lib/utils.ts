import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Strip HTML tags and normalize for plain-text display (e.g. Calendar description). Block tags become newlines. */
export function stripHtml(html: string): string {
  if (!html || typeof html !== "string") return ""
  let text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/ol>|<\/ul>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\n /g, "\n")
    .replace(/ \n/g, "\n")
    .replace(/\n{2,}/g, "\n\n")
    .trim()
}

/** Convert simple markdown to plain text so **bold** and *italic* don't show as raw symbols. */
export function markdownToPlainText(md: string): string {
  if (!md || typeof md !== "string") return ""
  return (
    md
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      .replace(/^[-*]\s+/gm, "• ")
      .replace(/^\d+\.\s+/gm, "")
      .trim()
  )
}
