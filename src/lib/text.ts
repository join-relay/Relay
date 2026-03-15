/**
 * Decode HTML entities in a string so apostrophes and other characters
 * display correctly (e.g. &#39; → ', &apos; → ').
 */
export function decodeHtmlEntities(str: string): string {
  if (!str || typeof str !== "string") return str;
  return str
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}
