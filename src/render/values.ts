import type { Align, VerticalAlign } from "../types.js";

/**
 * Coercion for values that reach the output as raw attributes.
 *
 * TypeScript says `align` is `"left" | "center" | "right"`, and that is a promise about code
 * this package compiles — not about a document. Documents arrive as JSON from a database,
 * an API, an agent, or a file someone edited by hand, and `validateDocument` checks structure
 * rather than every enum. So a `divider` whose `align` is
 * `left"><script>alert(1)</script><x y="` used to put a live script tag in the mail.
 *
 * Escaping alone would have stopped the script and still emitted nonsense. Coercing to a
 * known value stops both: an attribute is either one of the values the renderer understands
 * or it is the default, and there is no third outcome.
 */

const ALIGNS = new Set<Align>(["left", "center", "right"]);
const VERTICAL = new Set<VerticalAlign>(["top", "middle", "bottom"]);

export function align(value: unknown, fallback: Align = "left"): Align {
  return ALIGNS.has(value as Align) ? (value as Align) : fallback;
}

export function verticalAlign(value: unknown, fallback: VerticalAlign = "top"): VerticalAlign {
  return VERTICAL.has(value as VerticalAlign) ? (value as VerticalAlign) : fallback;
}

/** Heading level, clamped to what the renderer emits — `level: 9` produced `<h9>` before. */
export function headingLevel(value: unknown): 1 | 2 | 3 {
  return value === 1 || value === 2 || value === 3 ? value : 2;
}

/**
 * A finite number in range. Guards the arithmetic as much as the output: `undefined` in a
 * size field used to render as `font-size:undefinedpx`, and a width of `NaN` as
 * `width="undefined"` inside the Outlook ghost table.
 */
export function num(value: unknown, fallback: number, min = 0, max = 100_000): number {
  const n = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
