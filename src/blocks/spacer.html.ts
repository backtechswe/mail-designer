import type { SpacerBlock } from "../types.js";
import { escAttr } from "../render/esc.js";
import { TABLE_RESET, css, px } from "../render/style.js";
import { num } from "../render/values.js";

/**
 * Vertical space that survives everywhere. The height attribute is for Outlook, the
 * inline height for the rest, and font-size:0 stops the &nbsp; from adding a stray line.
 */
export function renderSpacer(block: SpacerBlock): string {
  const height = num(block.height, 24, 0, 2000);
  const style = css({ height: px(height), "font-size": 0, "line-height": 0 });
  return (
    `<table${TABLE_RESET} width="100%"><tr>` +
    `<td height="${height}" style="${escAttr(style)}">&nbsp;</td>` +
    `</tr></table>`
  );
}
