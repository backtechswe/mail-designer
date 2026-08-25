import { DATA_TOKEN } from "../render/dataFields.js";

/**
 * Data tokens as pills, in the editor only.
 *
 * `[Namn]` in running text is easy to miss and easy to mistake for something the recipient
 * will read. A pill cannot be mistaken for prose. But the pill exists only in the canvas: the
 * document keeps the plain token, and so does every byte the renderer emits — decorating the
 * stored HTML would put editor chrome in the sent email.
 *
 * So the DOM and the model differ by exactly this transformation, applied on the way in and
 * reversed on the way out. Both directions are pure string functions, which is the only way
 * to be sure the round trip is lossless — see test/tokens.test.mjs.
 */

/** Attribute carrying the original token, so stripping never depends on the rendered text. */
const ATTR = "data-md-token";

const TAG = /<[^>]*>/g;
const PILL_OPEN = new RegExp(`<span[^>]*${ATTR}="([^"]*)"[^>]*>`, "g");
const SPAN = /<(\/?)span\b[^>]*>/g;

function escAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function unescAttr(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function escText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** The markup for one pill. Also used when inserting at the caret, so both paths agree. */
export function pill(token: string): string {
  const name = token.slice(1, -1).trim();
  return (
    `<span class="md-token" ${ATTR}="${escAttr(token)}" contenteditable="false">` +
    `${escText(name)}</span>`
  );
}

/**
 * Wrap every token in text content with a pill.
 *
 * Tags are skipped whole, so a token inside an attribute — `href="https://x/[Id]"` — is left
 * alone. It is a real token and the renderer will substitute it, but it is not text on the
 * page and there is nothing there to decorate.
 */
export function decorateTokens(html: string): string {
  if (!html || !html.includes("[")) return html;

  let out = "";
  let last = 0;
  TAG.lastIndex = 0;
  for (let tag = TAG.exec(html); tag !== null; tag = TAG.exec(html)) {
    out += decorateText(html.slice(last, tag.index)) + tag[0];
    last = tag.index + tag[0].length;
  }
  return out + decorateText(html.slice(last));
}

function decorateText(text: string): string {
  DATA_TOKEN.lastIndex = 0;
  return text.replace(DATA_TOKEN, (whole) => pill(whole));
}

/**
 * Turn pills back into their tokens.
 *
 * Reads the token from the attribute rather than from the element's text, because the text is
 * the field's name without its brackets — and because a browser is free to have moved
 * anything else inside the span in the meantime.
 */
export function stripTokens(html: string): string {
  if (!html || !html.includes(ATTR)) return html;

  let out = "";
  let cursor = 0;
  PILL_OPEN.lastIndex = 0;
  for (let open = PILL_OPEN.exec(html); open !== null; open = PILL_OPEN.exec(html)) {
    if (open.index < cursor) continue;
    const end = endOfSpan(html, open.index + open[0].length);
    out += html.slice(cursor, open.index) + unescAttr(open[1] ?? "");
    cursor = end;
    PILL_OPEN.lastIndex = end;
  }
  return out + html.slice(cursor);
}

/**
 * The index just past the `</span>` closing the span that started at `from`, counting nesting.
 *
 * A regex ending at the first `</span>` would be right until the day a browser puts a span
 * inside the pill — applying a colour across a selection that contains one is enough — and
 * then it would leave a stray closing tag in the *document*. Cheap to do properly.
 */
function endOfSpan(html: string, from: number): number {
  let depth = 1;
  SPAN.lastIndex = from;
  for (let tag = SPAN.exec(html); tag !== null; tag = SPAN.exec(html)) {
    depth += tag[1] === "/" ? -1 : 1;
    if (depth === 0) return tag.index + tag[0].length;
  }
  return html.length;
}
