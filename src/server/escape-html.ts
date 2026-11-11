const ENTITY: Readonly<Record<string, string>> = Object.freeze({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
});

/**
 * Escapes the five characters that matter in HTML text and in double-quoted attribute values
 * (server-and-viewer 9.6). Every `&` in the output starts one of the five entities.
 */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ENTITY[ch] ?? ch);
}
