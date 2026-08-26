import type { MailDocument, RenderResult } from "../types.js";
import { walkBlocks } from "../document.js";

/**
 * Checks on the rendered mail that a preview cannot show.
 *
 * These are the failures that look fine in every browser and then go wrong in a real inbox:
 * a mail Gmail truncates, an image Gmail refuses to load, a background Outlook drops. None of
 * them throws, so the only way anyone finds out is a check that names them.
 */

export type WarningId =
  | "gmail-clipping"
  | "data-uri-image"
  | "background-image"
  | "no-preheader"
  | "missing-alt"
  | "wide-content"
  | "no-plain-text"
  | "no-dark-mode";

export interface EmailWarning {
  id: WarningId;
  /** "error" is something a recipient will certainly notice; "warning" is a risk. */
  level: "error" | "warning";
  /** Block ids the warning is about, where it is about specific blocks. */
  blocks?: string[];
  /** Numbers worth showing, e.g. the byte count. */
  detail?: Record<string, number | string>;
}

/** Gmail truncates a message past roughly 102 KB and shows "[Message clipped]". */
export const GMAIL_CLIP_BYTES = 102_400;

export function inspectEmail(doc: MailDocument, result: RenderResult): EmailWarning[] {
  const warnings: EmailWarning[] = [];
  const bytes = new TextEncoder().encode(result.html).length;

  if (bytes > GMAIL_CLIP_BYTES) {
    // Everything past the cut is replaced by a "view entire message" link, which most people
    // do not click — so a footer or an unsubscribe link can vanish from view entirely.
    warnings.push({
      id: "gmail-clipping",
      level: "error",
      detail: { bytes, limit: GMAIL_CLIP_BYTES },
    });
  }

  if (!result.text.trim()) {
    warnings.push({ id: "no-plain-text", level: "warning" });
  }

  if (!doc.settings.preheader?.trim()) {
    warnings.push({ id: "no-preheader", level: "warning" });
  }

  if (!doc.settings.dark) {
    // Apple Mail, iOS Mail and Outlook.com invert colours on their own when the reader is in
    // dark mode, and they do it badly: text and backgrounds flip, but an image does not. A PNG
    // logo on a white background stays a glowing white rectangle in the middle of a dark
    // message. Four colours is all it takes to be asked instead of guessed at.
    warnings.push({ id: "no-dark-mode", level: "warning" });
  }

  if (doc.settings.width > 640) {
    warnings.push({
      id: "wide-content",
      level: "warning",
      detail: { width: doc.settings.width },
    });
  }

  const dataUri: string[] = [];
  const missingAlt: string[] = [];
  const backgrounds: string[] = [];

  walkBlocks(doc, (block) => {
    if (block.type === "image") {
      // Gmail refuses data: URIs in <img> outright — the recipient sees the alt text.
      if (/^\s*data:/i.test(block.src)) dataUri.push(block.id);
      if (block.src && !block.alt.trim()) missingAlt.push(block.id);
    }
    if (block.type === "section" && block.backgroundUrl) {
      // Outlook needs a VML fallback for a section background image, which this renderer
      // does not emit: the colour behind it is what Outlook will show.
      backgrounds.push(block.id);
    }
  });

  if (dataUri.length > 0) {
    warnings.push({ id: "data-uri-image", level: "error", blocks: dataUri });
  }
  if (missingAlt.length > 0) {
    warnings.push({ id: "missing-alt", level: "warning", blocks: missingAlt });
  }
  if (backgrounds.length > 0) {
    warnings.push({ id: "background-image", level: "warning", blocks: backgrounds });
  }

  return warnings;
}

/** Size of the rendered HTML in bytes, as a mail server would count it. */
export function emailSize(html: string): number {
  return new TextEncoder().encode(html).length;
}
