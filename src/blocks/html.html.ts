import type { HtmlBlock } from "../types.js";
import { sanitizeBlock } from "../render/sanitize.js";

/**
 * The escape hatch. Sanitised but otherwise untouched — if someone reaches for this block
 * they want their own markup, so we do not second-guess the layout.
 */
export function renderRawHtml(block: HtmlBlock): string {
  return sanitizeBlock(block.html ?? "");
}
