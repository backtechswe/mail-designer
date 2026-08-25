/**
 * Inline style construction. Declarations keep insertion order, which is what makes the
 * golden-file tests readable and stable — reorder a property here and the diff shows it.
 */

import { isColour, safeCssValue } from "./esc.js";

export type StyleMap = Record<string, string | number | false | null | undefined>;

export function px(value: number): string {
  return `${value}px`;
}

export function pct(value: number): string {
  return `${value}%`;
}

/** [t,r,b,l] -> "1px 2px 3px 4px". */
export function spacing(value: readonly [number, number, number, number]): string {
  return value.map(px).join(" ");
}

/**
 * Drops undefined/null/false entries so callers can build maps conditionally.
 *
 * Every value passes through `safeCssValue`, and this is the single choke point that makes
 * that worth doing: every colour, font stack and background URL in the document reaches the
 * output through here. Without it `textColor: "red;background:url(http://tracker/x)"` is a
 * working beacon in every mail sent, and the document model lets a user type exactly that.
 */
export function css(style: StyleMap): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(style)) {
    if (value === undefined || value === null || value === false || value === "") continue;
    const safe = typeof value === "number" ? String(value) : safeCssValue(value);
    if (safe === "") continue;
    // A colour field is free text in the editor, so it is where an injected declaration
    // would arrive. Anything that is not a colour is dropped rather than emitted.
    if (/color$/i.test(key) && !isColour(safe)) continue;
    parts.push(`${key}:${safe}`);
  }
  return parts.join(";");
}

/**
 * The four attributes every layout table in an email needs. role="presentation" keeps
 * screen readers from announcing the layout scaffolding as a data table.
 */
export const TABLE_RESET = ' role="presentation" cellpadding="0" cellspacing="0" border="0"';
