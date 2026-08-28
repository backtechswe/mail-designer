import type { Block, MailDocument } from "../types.js";
import { walkBlocks } from "../document.js";
import { escAttr } from "./esc.js";
import { sanitizeInline, stripTags } from "./sanitize.js";

/**
 * Merge fields are [Bracketed] tokens. They survive rendering untouched and are
 * substituted afterwards, per recipient — which means one render can serve a whole
 * mailing list, and the host app decides where the values come from.
 */
export const DATA_TOKEN = /\[([^[\]\n]{1,64})\]/g;

export interface DataOptions {
  /**
   * "html" escapes the substituted value. Always use it when the target is markup —
   * a recipient named `Ben & Jerry's` must not be able to break the document.
   */
  escape?: "html" | "none";
  /** "keep" leaves an unmatched token visible (default); "blank" removes it. */
  onMissing?: "keep" | "blank";
  /**
   * The names that are data fields. When given, every other [Bracketed] run is left exactly
   * as it was found.
   *
   * This exists because the renderer writes brackets of its own. `<!--[if mso]>` and
   * `<![endif]-->` hold the Outlook ghost table together, and `[data-ogsb]` / `[data-ogsc]`
   * are what Outlook.com's dark mode is keyed on — all of them match DATA_TOKEN. With
   * onMissing "keep" that was invisible, because an unmatched token is left alone anyway.
   * With "blank" they were erased, which turns `<!--[if mso]>` into `<!-->`: an
   * abrupt-closing comment that every client ends the comment at, so the ghost table becomes
   * live markup and the layout doubles. Not an Outlook-only bug — a broken email everywhere.
   *
   * An allowlist rather than a list of reserved patterns, because the reserved list would
   * need extending every time the renderer learns a new client workaround, and forgetting
   * would be silent. A token the document itself never declared is not a data field.
   */
  fields?: readonly string[];
  /**
   * Fields whose value is markup rather than text.
   *
   * Escaping is the default and stays the default: a recipient called `Ben & Jerry's` must
   * not be able to break the document, and that is not negotiable for a value that came from
   * a row in someone's database. But a host that has *composed* a fragment itself — a styled
   * list, a badge — had no way to pass it through, and rendering it as visible tag soup is
   * not an answer either.
   *
   * So "raw" means markup is allowed, not that anything is. The value goes through the same
   * sanitiser as an html block: the tag and attribute allowlist still applies, script and
   * event handlers and executable URL schemes still go. What the host takes responsibility
   * for is the *shape* of the markup, not the safety of it.
   *
   * In the plain-text alternative the tags are stripped, since text has no markup to allow.
   *
   * One consequence to know: the value is treated exactly like the contents of an html
   * block, which means you write your own entities. A bare `&` is passed through rather than
   * turned into `&amp;`, because escaping it would double-escape the entities an author
   * legitimately wrote. Every client renders a bare ampersand, but it is your string now.
   */
  raw?: readonly string[];
}

export function applyDataValues(
  input: string,
  values: Record<string, string> | undefined,
  options: DataOptions = {},
): string {
  if (!input) return input;
  const { escape = "html", onMissing = "keep", fields, raw } = options;
  const rawFields = raw?.length ? new Set(raw.map((f) => f.trim().toLowerCase())) : null;
  // Matched the way substitution matches below: trimmed and case-insensitive, so `[ namn ]`
  // and `[NAMN]` are the same field to the allowlist as they are to the lookup.
  const declared = fields ? new Set(fields.map((f) => f.trim().toLowerCase())) : null;

  return input.replace(DATA_TOKEN, (whole, name: string) => {
    const key = name.trim();
    if (declared && !declared.has(key.toLowerCase())) return whole;
    const value = values?.[key] ?? (values ? findCaseInsensitive(values, key) : undefined);
    if (value === undefined) return onMissing === "blank" ? "" : whole;
    if (rawFields?.has(key.toLowerCase())) {
      return escape === "html" ? sanitizeInline(value) : stripTags(value);
    }
    return escape === "html" ? escAttr(value) : value;
  });
}

function findCaseInsensitive(
  values: Record<string, string>,
  key: string,
): string | undefined {
  const lower = key.toLowerCase();
  for (const [k, v] of Object.entries(values)) {
    if (k.toLowerCase() === lower) return v;
  }
  return undefined;
}

/**
 * Every token used anywhere in the document, in the order they appear. The host app
 * uses this to tell the user which columns the design actually needs — including the
 * ones hidden in a button's URL, which is exactly the case people forget.
 */
export function extractDataFields(doc: MailDocument): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  const take = (name: string): void => {
    if (seen.has(name)) return;
    seen.add(name);
    order.push(name);
  };

  for (const name of tokensIn(doc.settings.preheader)) take(name);
  walkBlocks(doc, (block) => {
    for (const name of fieldsInBlock(block)) take(name);
  });

  return order;
}

/** Tokens in one string, trimmed, in order. */
function tokensIn(value: string | undefined): string[] {
  if (!value) return [];
  const names: string[] = [];
  for (const match of value.matchAll(DATA_TOKEN)) {
    const name = (match[1] ?? "").trim();
    if (name) names.push(name);
  }
  return names;
}

/**
 * The fields one block refers to, ignoring its children.
 *
 * Deliberately the only place that knows which properties of which block type can hold a
 * token. extractDataFields and the hideWhenEmpty pruning both read it, so they cannot drift
 * — which they did: backgroundUrl and iconUrl were missing here for a release, and a host
 * asking which columns a design needs was told the wrong answer.
 */
export function fieldsInBlock(block: Block): string[] {
  const names: string[] = [];
  const scan = (value: string | undefined): void => {
    names.push(...tokensIn(value));
  };

  {
    switch (block.type) {
      case "heading":
      case "text":
      case "html":
        scan(block.html);
        break;
      case "image":
        scan(block.alt);
        scan(block.src);
        scan(block.href);
        break;
      case "button":
        scan(block.label);
        scan(block.href);
        break;
      case "social":
        for (const item of block.items) {
          scan(item.href);
          scan(item.label);
          scan(item.iconUrl);
        }
        break;
      case "section":
        scan(block.backgroundUrl);
        break;
      default:
        break;
    }
  }

  return names;
}
