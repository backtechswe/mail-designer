/**
 * Pretty-print email HTML for reading.
 *
 * The renderer emits one unbroken string, which is right for what is sent — every byte counts
 * against Gmail's clipping limit — and unreadable for anyone trying to check what was
 * produced. This puts the structure back without touching the content.
 *
 * The rule that keeps it safe: **whitespace is only ever added between block-level tags.**
 * A newline inside inline content collapses to a space in the mail, so `<a>Läs</a>,` must
 * never become `<a>Läs</a>\n,` — that renders as "Läs ," in every client. So a line that has
 * picked up any content stays one line until its block closes, and `<td>Hej</td>` comes out
 * whole. See test/format.test.mjs, where the invariant is that collapsing the added
 * whitespace returns the original string exactly.
 */

const INDENT = "  ";

/**
 * Tags whose boundaries are safe to break at. Table structure, the document frame, and the
 * VML elements Outlook needs — everything else is treated as inline and left alone.
 */
const BLOCK = new Set([
  "html",
  "head",
  "body",
  "style",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "td",
  "th",
  "div",
  "center",
  "xml",
  "o:officedocumentsettings",
  "v:roundrect",
  "v:textbox",
  "w:anchorlock",
  "title",
]);

/**
 * Void elements that belong on a line of their own. Only the ones that live in <head>: an
 * <img> or a <br> sits in running content, where a line break would change the rendering.
 */
const VOID_BLOCK = new Set(["meta", "link", "base"]);

const VOID = new Set(["br", "img", "meta", "link", "hr", "input", "area", "base", "col"]);

interface Token {
  kind: "text" | "open" | "close" | "self" | "comment" | "doctype";
  raw: string;
  name: string;
}

const TAG = /<!--[\s\S]*?-->|<!\[[\s\S]*?\]>|<!?\/?[a-zA-Z][^>]*>|<!DOCTYPE[^>]*>/gi;

function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  TAG.lastIndex = 0;

  for (let match = TAG.exec(html); match !== null; match = TAG.exec(html)) {
    if (match.index > last) {
      tokens.push({ kind: "text", raw: html.slice(last, match.index), name: "" });
    }
    tokens.push(classify(match[0]));
    last = match.index + match[0].length;
  }
  if (last < html.length) tokens.push({ kind: "text", raw: html.slice(last), name: "" });
  return tokens;
}

function classify(raw: string): Token {
  if (raw.startsWith("<!--") || raw.startsWith("<![")) return { kind: "comment", raw, name: "" };
  if (/^<!doctype/i.test(raw)) return { kind: "doctype", raw, name: "" };

  const name = (/^<\/?\s*([a-zA-Z][a-zA-Z0-9:-]*)/.exec(raw)?.[1] ?? "").toLowerCase();
  if (raw.startsWith("</")) return { kind: "close", raw, name };
  if (raw.endsWith("/>") || VOID.has(name)) return { kind: "self", raw, name };
  return { kind: "open", raw, name };
}

export function formatHtml(html: string): string {
  const lines: string[] = [];
  let line = "";
  let depth = 0;
  /*
   * Whether the last thing emitted was a block boundary. It decides who owns the whitespace
   * that follows: between block tags it is insignificant and the formatter replaces it, but
   * next to inline content it is the document's — `</b> <i>` renders a space and dropping it
   * would change the mail.
   */
  let afterBlock = true;

  const pad = (n: number): string => INDENT.repeat(Math.max(0, n));
  const flush = (): void => {
    if (line.trim().length > 0) lines.push(line);
    line = "";
  };
  const own = (text: string, at: number): void => {
    flush();
    // A comment that already spans lines — the MSO conditionals do — keeps its breaks and
    // gets the current indentation on each, rather than one indented line and a ragged rest.
    for (const part of text.split("\n")) lines.push(pad(at) + part.trim());
  };
  const append = (text: string): void => {
    if (line.length === 0) line = pad(depth);
    line += text;
  };

  for (const token of tokenize(html)) {
    switch (token.kind) {
      case "doctype":
      case "comment":
        // MSO conditionals wrap whole tables; on their own line they read as the structural
        // markers they are rather than as noise inside a row.
        own(token.raw, depth);
        afterBlock = true;
        break;

      case "open":
        if (BLOCK.has(token.name)) {
          flush();
          line = pad(depth) + token.raw;
          depth += 1;
          afterBlock = true;
        } else {
          append(token.raw);
          afterBlock = false;
        }
        break;

      case "close":
        if (BLOCK.has(token.name)) {
          depth -= 1;
          // Content since the opening tag means this element is a single line; nothing since
          // means its children took lines of their own and the closing tag needs one too.
          if (line.length > 0) {
            line += token.raw;
            flush();
          } else {
            own(token.raw, depth);
          }
          afterBlock = true;
        } else {
          append(token.raw);
          afterBlock = false;
        }
        break;

      case "self":
        if (VOID_BLOCK.has(token.name)) {
          own(token.raw, depth);
          afterBlock = true;
        } else {
          append(token.raw);
          afterBlock = false;
        }
        break;

      case "text": {
        if (token.raw.trim().length === 0) {
          if (!afterBlock) append(token.raw);
          break;
        }
        // A multi-line text node — the <style> block is the one that matters — keeps its own
        // line breaks and gets the current indentation on each.
        const [first, ...rest] = token.raw.split("\n");
        append(first ?? "");
        for (const part of rest) {
          flush();
          // Blank lines are dropped rather than indented: a line of nothing but spaces would
          // come back as content on the next pass, and formatting would stop being idempotent.
          if (part.trim().length > 0) lines.push(pad(depth) + part.trim());
        }
        afterBlock = false;
        break;
      }
    }
  }

  flush();
  return lines.join("\n");
}
