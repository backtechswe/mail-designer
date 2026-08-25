/**
 * A very small syntax highlighter for the code view.
 *
 * Not a general one — it handles exactly the two languages this package produces, and it is a
 * pure string function so it can be tested without a DOM. Email HTML is the case that needs
 * it: the output is full of MSO conditional comments and ghost tables, and an unlit 40 kB wall
 * of markup is something you copy without reading. Highlighted, the conditionals stand out as
 * the comments they are, which is the difference between a code view you inspect and one you
 * only paste from.
 *
 * Every branch escapes before it wraps, so the highlighter can never inject markup of its own.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const span = (cls: string, text: string): string =>
  text ? `<span class="md-hl-${cls}">${escapeHtml(text)}</span>` : "";

/** Comments (MSO conditionals included), doctype, tags with their attributes, and text. */
export function highlightHtml(source: string): string {
  let out = "";
  let index = 0;

  while (index < source.length) {
    const next = source.indexOf("<", index);
    if (next === -1) {
      out += escapeHtml(source.slice(index));
      break;
    }
    out += escapeHtml(source.slice(index, next));

    if (source.startsWith("<!--", next)) {
      const end = source.indexOf("-->", next);
      const stop = end === -1 ? source.length : end + 3;
      out += span("comment", source.slice(next, stop));
      index = stop;
      continue;
    }

    const close = source.indexOf(">", next);
    if (close === -1) {
      out += escapeHtml(source.slice(next));
      break;
    }
    out += highlightTag(source.slice(next, close + 1));
    index = close + 1;
  }

  return out;
}

const TAG_NAME = /^<\/?([a-zA-Z0-9:!?-]*)/;
const ATTRIBUTE = /([a-zA-Z-:@]+)(\s*=\s*)("[^"]*"|'[^']*'|[^\s>]+)?/g;

function highlightTag(tag: string): string {
  const name = TAG_NAME.exec(tag);
  if (!name) return escapeHtml(tag);

  const head = name[0];
  const rest = tag.slice(head.length);
  let out = span("punct", head.startsWith("</") ? "</" : "<") + span("tag", name[1] ?? "");

  let cursor = 0;
  ATTRIBUTE.lastIndex = 0;
  for (let attr = ATTRIBUTE.exec(rest); attr !== null; attr = ATTRIBUTE.exec(rest)) {
    out += escapeHtml(rest.slice(cursor, attr.index));
    out += span("attr", attr[1] ?? "") + span("punct", attr[2] ?? "") + span("value", attr[3] ?? "");
    cursor = attr.index + attr[0].length;
  }
  return out + escapeHtml(rest.slice(cursor));
}

const JSON_TOKEN =
  /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b/g;

/** Keys, strings, numbers and literals. Punctuation is left plain — it is already quiet. */
export function highlightJson(source: string): string {
  let out = "";
  let cursor = 0;
  JSON_TOKEN.lastIndex = 0;

  for (let m = JSON_TOKEN.exec(source); m !== null; m = JSON_TOKEN.exec(source)) {
    out += escapeHtml(source.slice(cursor, m.index));
    if (m[1] !== undefined) {
      // A string followed by a colon is a key, and the colon comes along so the pair reads
      // as one thing.
      out += m[2] ? span("key", m[1]) + span("punct", m[2]) : span("value", m[1]);
    } else if (m[3] !== undefined) {
      out += span("number", m[3]);
    } else {
      out += span("literal", m[4] ?? "");
    }
    cursor = m.index + m[0].length;
  }

  return out + escapeHtml(source.slice(cursor));
}
