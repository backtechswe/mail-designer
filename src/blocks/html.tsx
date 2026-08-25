import type { HtmlBlock } from "../types.js";
import { sanitizeBlock } from "../render/sanitize.js";

export function HtmlView({ block }: { block: HtmlBlock }) {
  // Sanitised before it reaches the canvas: a stored document may have been written
  // elsewhere, and the canvas runs in the host app's origin.
  return (
    <div className="md-rawhtml" dangerouslySetInnerHTML={{ __html: sanitizeBlock(block.html) }} />
  );
}
