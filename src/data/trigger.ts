/**
 * Deciding whether the caret is in the middle of asking for a data field.
 *
 * `@` is the gesture people already know from Slack, Notion, Teams and Google Docs, so it is
 * the primary trigger. `[` still works because it is the first character of the token itself,
 * and someone who has learned to type `[Name]` by hand should keep getting help.
 *
 * The obvious objection to `@` is email addresses, and there is a settled answer used by every
 * app that does this: **only trigger when the `@` follows a word boundary.** In
 * `anna@example.com` the `@` follows `a`, so nothing opens. In `Hi @` it follows a space,
 * so it does. That one rule removes almost the whole problem; a second `@` inside the query
 * closes it again, which covers the rest.
 *
 * Pure on purpose — this is the part where an off-by-one silently pops a menu over someone's
 * email address, and that is not something to verify by typing.
 */

export const TRIGGER_CHARS = ["@", "["] as const;

/** Beyond this the user is plainly writing prose, not choosing a field. */
const MAX_QUERY = 32;

/** Characters that count as a boundary before an `@`. */
const BOUNDARY = /[\s(["'{> –—-]/;

export interface TriggerMatch {
  /** Which character opened it. */
  char: (typeof TRIGGER_CHARS)[number];
  /** Offset of that character in the text passed in. */
  from: number;
  /** What has been typed after it. */
  query: string;
}

/**
 * @param textBeforeCaret the text run up to the caret, from the caret's own text node.
 */
export function findTrigger(textBeforeCaret: string): TriggerMatch | null {
  const text = textBeforeCaret;

  for (let i = text.length - 1; i >= 0; i -= 1) {
    if (text.length - i > MAX_QUERY + 1) return null;
    const char = text[i] as string;

    // A newline ends the run, and a closing bracket means the token before the caret is
    // already finished — there is nothing to complete in either case.
    if (char === "\n" || char === "]") return null;

    if (char !== "@" && char !== "[") continue;

    if (char === "@") {
      // Offset 0 counts as a boundary: a text run usually begins after an element boundary,
      // which is the start of a line or a paragraph.
      const before = i > 0 ? (text[i - 1] as string) : "";
      if (before !== "" && !BOUNDARY.test(before)) return null;
    }

    const query = text.slice(i + 1);
    // A second @ means an address, not a field name.
    if (query.includes("@")) return null;

    return { char, from: i, query };
  }

  return null;
}

/**
 * Fields matching a query: prefix matches first, then substring, each keeping the original
 * order. Case-insensitive, like substitution.
 */
export function rankFields(
  fields: readonly string[],
  query: string,
  /**
   * What the row shows, when that differs from the token. Searched as well as the token,
   * because a picker that displays "Förnamn" and only matches "FirstName" is a picker the
   * user concludes is broken — they type what they can see.
   */
  labelOf?: (field: string) => string,
): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...fields];
  const prefix: string[] = [];
  const contains: string[] = [];
  for (const field of fields) {
    const label = labelOf?.(field);
    const terms = label && label !== field ? [field.toLowerCase(), label.toLowerCase()] : [field.toLowerCase()];
    if (terms.some((t) => t.startsWith(q))) prefix.push(field);
    else if (terms.some((t) => t.includes(q))) contains.push(field);
  }
  return [...prefix, ...contains];
}
