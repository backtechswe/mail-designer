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

/**
 * A spacing tuple, from whatever the document actually holds.
 *
 * `Spacing` is `[top, right, bottom, left]`, and the type says so — but a document is JSON.
 * The shapes below all reached the renderer from real documents and none were caught:
 * `{ top, right, bottom, left }` and `"12px 24px"` are what an agent or a hand-written
 * fixture produces, and both crashed on `value.map is not a function`. `[NaN, 0, 0, 0]` did
 * not crash at all — it emitted `padding:NaNpx`, which is worse, because invalid CSS in a
 * sent email is not visible from here.
 *
 * Shorthand expands the way CSS does, since that is what someone writing one or two numbers
 * means. Anything that cannot be read as four numbers returns null, and the caller decides
 * whether that is an error to report or a value to default.
 */
export function toSpacing(value: unknown): [number, number, number, number] | null {
  const parts = spacingParts(value);
  if (!parts || parts.length < 1 || parts.length > 4) return null;
  if (!parts.every((n) => Number.isFinite(n))) return null;
  // CSS shorthand: 1 -> all, 2 -> vertical/horizontal, 3 -> top/sides/bottom.
  const [t, r, b, l] = parts;
  const top = t as number;
  const right = r ?? top;
  const bottom = b ?? top;
  const left = l ?? right;
  return [top, right, bottom, left];
}

function spacingParts(value: unknown): number[] | null {
  if (Array.isArray(value)) {
    const nums = value.map((v) => (typeof v === "string" ? Number(v.trim()) : v));
    return nums.every((n) => typeof n === "number") ? (nums as number[]) : null;
  }
  if (typeof value === "string") {
    const tokens = value.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return null;
    const nums = tokens.map((t) => Number(t.replace(/px$/i, "")));
    return nums.every((n) => Number.isFinite(n)) ? nums : null;
  }
  if (typeof value === "object" && value !== null) {
    const o = value as Record<string, unknown>;
    // Only the full object form. Half of one is a mistake, not a shorthand, and guessing
    // which side the author meant would be worse than saying no.
    const keys = ["top", "right", "bottom", "left"] as const;
    if (!keys.every((k) => k in o)) return null;
    const nums = keys.map((k) => (typeof o[k] === "string" ? Number(o[k]) : o[k]));
    return nums.every((n) => typeof n === "number") ? (nums as number[]) : null;
  }
  return null;
}

/** The same, with a fallback — for the renderer, which must always emit something valid. */
export function spacingOf(
  value: unknown,
  fallback: [number, number, number, number] = [0, 0, 0, 0],
): [number, number, number, number] {
  return toSpacing(value) ?? fallback;
}
