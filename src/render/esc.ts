/** Escaping and URL safety. Small on purpose — these run on every node we emit. */

const TEXT: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
const ATTR: Record<string, string> = { ...TEXT, '"': "&quot;", "'": "&#39;" };

/** For text nodes: the three characters that can end a text context. */
export function escText(value: string): string {
  return value.replace(/[&<>]/g, (c) => TEXT[c] as string);
}

/** For attribute values: also the quote characters. */
export function escAttr(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ATTR[c] as string);
}

const UNSAFE_SCHEME = /^\s*(javascript|vbscript|data|file):/i;

/**
 * Neutralise a link target. Anything with an executable scheme becomes "#" rather than
 * being dropped, so the layout stays intact and the dead link is visible in review.
 */
export function safeUrl(value: string): string {
  const url = (value ?? "").trim();
  if (!url) return "";
  if (UNSAFE_SCHEME.test(url)) return "#";
  return url;
}

/**
 * Image sources may be data: URIs — inline base64 is legitimate here even though Gmail
 * blocks it, so we keep it and let the sender find out in a test send.
 */
export function safeImageUrl(value: string): string {
  const url = (value ?? "").trim();
  if (!url) return "";
  if (/^\s*(javascript|vbscript|file):/i.test(url)) return "";
  return url;
}
