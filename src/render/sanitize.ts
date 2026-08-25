/**
 * A small, dependency-free HTML sanitiser.
 *
 * Scope, stated plainly: this exists so a stored document cannot execute script when the
 * editor renders it back into the canvas, and so we never emit an event handler into an
 * email. It is a whitelist over a regex tokeniser, not a full HTML parser, so treat it as
 * defence in depth rather than a hard security boundary against a hostile author. In the
 * intended use the author and the viewer are the same person; in a multi-tenant app where
 * they are not, sanitise again server-side with a real parser before storing.
 */

type AllowMap = Record<string, string[]>;

/** Text and heading blocks: only what an email client renders reliably inline. */
export const INLINE_TAGS: AllowMap = {
  a: ["href", "target", "rel", "title", "style"],
  b: ["style"],
  strong: ["style"],
  i: ["style"],
  em: ["style"],
  u: ["style"],
  s: ["style"],
  span: ["style"],
  br: [],
  p: ["style", "align"],
  ul: ["style"],
  ol: ["style"],
  li: ["style"],
  h1: ["style", "align"],
  h2: ["style", "align"],
  h3: ["style", "align"],
};

/** The raw-HTML block: also layout tables and images, since that is the point of it. */
export const BLOCK_TAGS: AllowMap = {
  ...INLINE_TAGS,
  div: ["style", "align", "class"],
  table: ["style", "width", "align", "border", "cellpadding", "cellspacing", "role", "class"],
  thead: ["style"],
  tbody: ["style"],
  tr: ["style", "valign", "class"],
  td: ["style", "width", "align", "valign", "colspan", "rowspan", "height", "class"],
  th: ["style", "width", "align", "valign", "colspan", "rowspan", "class"],
  img: ["src", "alt", "width", "height", "style", "border", "class"],
  hr: ["style"],
  small: ["style"],
  center: ["style"],
};

const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|form|noscript)\b[\s\S]*?<\/\1\s*>/gi;
const DROP_UNCLOSED = /<(script|style|iframe|object|embed|form|noscript)\b[^>]*>/gi;
const COMMENTS = /<!--[\s\S]*?-->/g;
const TAG = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^<>"']|"[^"]*"|'[^']*')*)\/?>/g;
const ATTRIBUTE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'<>`]+))/g;
const UNSAFE_VALUE = /(javascript|vbscript)\s*:/i;
const VOID_TAGS = new Set(["br", "img", "hr"]);

function cleanAttributes(raw: string, allowed: string[]): string {
  if (allowed.length === 0) return "";
  const out: string[] = [];
  for (const match of raw.matchAll(ATTRIBUTE)) {
    const name = (match[1] ?? "").toLowerCase();
    const value = match[3] ?? match[4] ?? match[5] ?? "";
    // Every on* attribute goes, allowed or not — this is the one rule with no exceptions.
    if (name.startsWith("on")) continue;
    if (!allowed.includes(name)) continue;
    if (UNSAFE_VALUE.test(value)) continue;
    // expression() and url(javascript:) in a style attribute are the old IE vectors.
    if (name === "style" && /expression\s*\(|url\s*\(\s*['"]?\s*(javascript|vbscript):/i.test(value)) {
      continue;
    }
    out.push(`${name}="${value.replace(/"/g, "&quot;")}"`);
  }
  return out.length ? " " + out.join(" ") : "";
}

export function sanitize(html: string, allowed: AllowMap = INLINE_TAGS): string {
  if (!html) return "";
  let out = html.replace(DROP_WITH_CONTENT, "").replace(DROP_UNCLOSED, "").replace(COMMENTS, "");

  out = out.replace(TAG, (whole, rawName: string, rawAttrs: string) => {
    const name = rawName.toLowerCase();
    const permitted = allowed[name];
    // Unknown tag: drop the tag, keep whatever text it wrapped.
    if (!permitted) return "";
    if (whole.startsWith("</")) return `</${name}>`;
    const attributes = cleanAttributes(rawAttrs ?? "", permitted);
    if (VOID_TAGS.has(name)) return `<${name}${attributes} />`;
    return `<${name}${attributes}>`;
  });

  return out;
}

export function sanitizeInline(html: string): string {
  return sanitize(html, INLINE_TAGS);
}

export function sanitizeBlock(html: string): string {
  return sanitize(html, BLOCK_TAGS);
}

/** Strip every tag and collapse whitespace — used to build the plain-text alternative. */
export function stripTags(html: string): string {
  return (html ?? "")
    .replace(DROP_WITH_CONTENT, "")
    .replace(COMMENTS, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h1|h2|h3|tr)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
