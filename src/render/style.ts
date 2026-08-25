/**
 * Inline style construction. Declarations keep insertion order, which is what makes the
 * golden-file tests readable and stable — reorder a property here and the diff shows it.
 */

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

/** Drops undefined/null/false entries so callers can build maps conditionally. */
export function css(style: StyleMap): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(style)) {
    if (value === undefined || value === null || value === false || value === "") continue;
    parts.push(`${key}:${value}`);
  }
  return parts.join(";");
}

/** name="value" pairs, skipping empties. Values are assumed pre-escaped. */
export function attrs(map: Record<string, string | number | false | null | undefined>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(map)) {
    if (value === undefined || value === null || value === false || value === "") continue;
    parts.push(`${key}="${value}"`);
  }
  return parts.length ? " " + parts.join(" ") : "";
}

/**
 * The four attributes every layout table in an email needs. role="presentation" keeps
 * screen readers from announcing the layout scaffolding as a data table.
 */
export const TABLE_RESET = ' role="presentation" cellpadding="0" cellspacing="0" border="0"';
