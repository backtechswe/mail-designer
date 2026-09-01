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

import { escAttr, safeImageUrl, safeStyleAttribute, safeUrl } from "./esc.js";

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
const COMMENTS = /<!--[\s\S]*?-->/g;
const ATTRIBUTE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'<>`]+)))?/g;
const VOID_TAGS = new Set(["br", "img", "hr"]);
const URL_ATTRIBUTES = new Set(["href", "src", "background", "action", "formaction"]);

function cleanAttributes(raw: string, allowed: string[]): string {
  if (allowed.length === 0) return "";
  const out: string[] = [];
  for (const match of raw.matchAll(ATTRIBUTE)) {
    const name = (match[1] ?? "").toLowerCase();
    const value = match[3] ?? match[4] ?? match[5] ?? "";
    // Every on* attribute goes, allowed or not — this is the one rule with no exceptions.
    if (name.startsWith("on")) continue;
    if (!allowed.includes(name)) continue;
    // The scheme test sees what a browser would: entities decoded, control characters gone.
    if (URL_ATTRIBUTES.has(name)) {
      const safe = name === "src" || name === "background" ? safeImageUrl(value) : safeUrl(value);
      if (!safe || safe === "#") continue;
      out.push(`${name}="${escAttr(safe)}"`);
      continue;
    }
    if (name === "style") {
      // Declaration by declaration: the attribute's semicolons are its structure, and a
      // cleaner that treats the whole thing as one value destroys every declaration but the
      // first. Anything that survives is a property and a value CSS would accept.
      const safe = safeStyleAttribute(value);
      if (!safe) continue;
      out.push(`style="${escAttr(safe)}"`);
      continue;
    }
    // Full attribute escaping, not just the quote. A raw `>` here would end the tag as far
    // as the next transform is concerned, and this output is fed to more of them.
    out.push(`${name}="${escAttr(value)}"`);
  }
  return out.length ? " " + out.join(" ") : "";
}

/**
 * The index just past the tag that starts at `from`, or -1 when the input ends first.
 *
 * Quote-aware, and deliberately tolerant: an unterminated quote ends at the end of input
 * rather than making the tag "not a tag". That is the difference between dropping
 * `<img src=x onerror=alert(1) title=">` and emitting it verbatim, which is what the old
 * regex did — it required a balanced pair, so a tag with an odd quote matched nothing at all
 * and `String.replace` passed it straight through.
 */
function endOfTag(html: string, from: number): number {
  let quote: string | null = null;
  for (let i = from; i < html.length; i += 1) {
    const char = html[i] as string;
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === ">") return i + 1;
  }
  return -1;
}

const TAG_START = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)/;

export function sanitize(html: string, allowed: AllowMap = INLINE_TAGS): string {
  if (!html) return "";
  const input = html.replace(DROP_WITH_CONTENT, "").replace(COMMENTS, "");

  let out = "";
  let cursor = 0;
  /* Tags opened and not yet closed, so a stray `</td>` cannot escape into the document. */
  const open: string[] = [];

  while (cursor < input.length) {
    const next = input.indexOf("<", cursor);
    if (next === -1) {
      out += input.slice(cursor);
      break;
    }
    out += input.slice(cursor, next);

    const head = TAG_START.exec(input.slice(next, next + 32));
    if (!head) {
      // Not a tag at all — a literal `<` in prose. Escape it; it must never reach the output
      // as something a parser could pick up.
      out += "&lt;";
      cursor = next + 1;
      continue;
    }

    const end = endOfTag(input, next);
    // No closing `>` before the end of input: whatever follows is an unfinished tag, and
    // dropping it is the only safe reading.
    if (end === -1) break;

    const name = (head[2] ?? "").toLowerCase();
    const closing = head[1] === "/";
    const permitted = allowed[name];
    cursor = end;

    // Unknown tag: drop the tag, keep whatever text it wrapped.
    if (!permitted) continue;

    if (closing) {
      // A closing tag with nothing open to close would land in the renderer's own table.
      const at = open.lastIndexOf(name);
      if (at === -1) continue;
      // Close anything left dangling inside it, so the nesting stays well-formed.
      for (let i = open.length - 1; i > at; i -= 1) out += `</${open[i]}>`;
      open.length = at;
      out += `</${name}>`;
      continue;
    }

    const attributes = cleanAttributes(input.slice(next + head[0].length, end - 1), permitted);
    if (VOID_TAGS.has(name)) {
      out += `<${name}${attributes} />`;
      continue;
    }
    out += `<${name}${attributes}>`;
    open.push(name);
  }

  // Whatever the author left open, we close. An unbalanced fragment would otherwise swallow
  // the rest of the email.
  for (let i = open.length - 1; i >= 0; i -= 1) out += `</${open[i]}>`;
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
