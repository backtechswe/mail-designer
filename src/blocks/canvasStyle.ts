import type { CSSProperties } from "react";
import type { HeadingBlock, MailSettings, Spacing, TextBlock } from "../types.js";

/**
 * Canvas styling that mirrors the HTML emitters.
 *
 * The canvas draws React components rather than the renderer's output — that is what makes
 * selection, inline editing and drop targets workable. The cost is that these numbers must
 * track `blocks/*.html.ts`. Anything the emitter derives (heading sizes, paragraph gap) is
 * derived by the same expression here, so a change stays a one-line change in two places
 * rather than a hunt.
 */

export const HEADING_SIZE: Record<1 | 2 | 3, number> = { 1: 30, 2: 24, 3: 19 };

export function spacingToCss(padding: Spacing | undefined): string {
  const value = padding ?? [0, 0, 0, 0];
  return value.map((n) => `${n}px`).join(" ");
}

export function headingStyle(block: HeadingBlock, settings: MailSettings): CSSProperties {
  return {
    margin: 0,
    fontFamily: block.fontFamily ?? settings.fontFamily,
    fontSize: HEADING_SIZE[block.level] ? (block.fontSize ?? HEADING_SIZE[block.level]) : block.fontSize,
    lineHeight: block.lineHeight ?? 1.25,
    fontWeight: "bold",
    color: block.color ?? settings.textColor,
    textAlign: block.align,
    // Consumed by .md-editable rules in styles.css, so nested <a> and <p> match the email.
    ["--md-link" as string]: settings.linkColor,
    ["--md-p-gap" as string]: "0px",
  };
}

export function textStyle(block: TextBlock, settings: MailSettings): CSSProperties {
  const size = block.fontSize ?? settings.fontSize;
  return {
    fontFamily: block.fontFamily ?? settings.fontFamily,
    fontSize: size,
    lineHeight: block.lineHeight ?? settings.lineHeight,
    color: block.color ?? settings.textColor,
    textAlign: block.align,
    ["--md-link" as string]: settings.linkColor,
    // Same 0.75 ratio the emitter uses, so spacing tracks type size identically.
    ["--md-p-gap" as string]: `${Math.round(size * 0.75)}px`,
  };
}

/** Turns a block's align into the flex alignment the canvas wrapper needs. */
export function alignToJustify(align: "left" | "center" | "right"): CSSProperties["justifyContent"] {
  return align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start";
}
