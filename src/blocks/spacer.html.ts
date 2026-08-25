import type { SpacerBlock } from "../types.js";
import { escAttr } from "../render/esc.js";
import { TABLE_RESET, css, px } from "../render/style.js";

/**
 * Vertical space that survives everywhere. The height attribute is for Outlook, the
 * inline height for the rest, and font-size:0 stops the &nbsp; from adding a stray line.
 */
export function renderSpacer(block: SpacerBlock): string {
  const style = css({ height: px(block.height), "font-size": 0, "line-height": 0 });
  return (
    `<table${TABLE_RESET} width="100%"><tr>` +
    `<td height="${block.height}" style="${escAttr(style)}">&nbsp;</td>` +
    `</tr></table>`
  );
}
